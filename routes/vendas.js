const express = require('express');
const db = require('../database');

const vendasRoutes = express.Router();
const statsRoutes = express.Router();

// GET /api/vendas
vendasRoutes.get('/', async (req, res) => {
    const indicadorId = req.query.indicador_id;
    const status = req.query.status;

    let query = `
    SELECT v.*, i.nome as indicador_nome, i.email as indicador_email
    FROM vendas v
    LEFT JOIN indicadores i ON v.indicador_id = i.id
    WHERE 1=1
  `;
    const params = [];
    let paramCount = 1;

    if (indicadorId) {
        query += ` AND v.indicador_id = $${paramCount}`;
        params.push(indicadorId);
        paramCount++;
    }

    if (status) {
        query += ` AND v.status = $${paramCount}`;
        params.push(status);
        paramCount++;
    }

    query += ' ORDER BY v.data_venda DESC';

    try {
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stats
statsRoutes.get('/', async (req, res) => {
    try {
        // 1. Total Vendas (Aprovadas)
        const resVendas = await db.query('SELECT COUNT(*) as count FROM vendas WHERE status = $1', ['APPROVED']);
        const totalVendas = parseInt(resVendas.rows[0].count, 10);

        // 2. Total Receita (Aprovadas)
        const resReceita = await db.query('SELECT SUM(valor) as total FROM vendas WHERE status = $1', ['APPROVED']);
        const totalReceita = parseFloat(resReceita.rows[0].total) || 0;

        // 3. Total Comissões (Aprovadas)
        const resComissao = await db.query('SELECT SUM(comissao_valor) as total FROM vendas WHERE status = $1', ['APPROVED']);
        const totalComissoes = parseFloat(resComissao.rows[0].total) || 0;

        // 4. Indicadores Ativos
        const resIndicadores = await db.query('SELECT COUNT(*) as count FROM indicadores WHERE ativo = 1');
        const indicadoresAtivos = parseInt(resIndicadores.rows[0].count, 10);

        // 5. Ranking de Indicadores (Mês Corrente)
        // No Postgres: DATE_TRUNC('month', data_venda) = DATE_TRUNC('month', CURRENT_DATE)
        const rankingQuery = `
      SELECT i.id, i.nome, i.email,
             COUNT(v.id) as vendas_aprovadas,
             SUM(COALESCE(v.comissao_valor, 0)) as comissoes_geradas
      FROM indicadores i
      LEFT JOIN vendas v ON i.id = v.indicador_id AND v.status = 'APPROVED' AND DATE_TRUNC('month', v.data_venda) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY i.id
      ORDER BY vendas_aprovadas DESC
      LIMIT 10
    `;
        const resRanking = await db.query(rankingQuery);

        // Convert counts and sums from string to correct types from PG result
        const ranking = resRanking.rows.map(r => ({
            ...r,
            vendas_aprovadas: parseInt(r.vendas_aprovadas, 10),
            comissoes_geradas: parseFloat(r.comissoes_geradas) || 0
        })).filter(r => r.vendas_aprovadas > 0);

        // 6. Vendas por Semana (Últimas 8 semanas)
        // No Postgres: TO_CHAR(data_venda, 'IYYY-IW') as semana
        const semanasQuery = `
      SELECT 
        TO_CHAR(data_venda, 'IYYY-IW') as semana,
        COUNT(*) as total_vendas
      FROM vendas
      WHERE status = 'APPROVED'
      GROUP BY semana
      ORDER BY semana DESC
      LIMIT 8
    `;
        const resSemanas = await db.query(semanasQuery);
        const vendasPorSemana = resSemanas.rows.map(r => ({
            semana: r.semana,
            total_vendas: parseInt(r.total_vendas, 10)
        })).reverse();

        res.json({
            total_vendas: totalVendas,
            total_receita: totalReceita,
            total_comissoes: totalComissoes,
            indicadores_ativos: indicadoresAtivos,
            ranking_indicadores: ranking,
            vendas_por_semana: vendasPorSemana
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = {
    vendasRoutes,
    statsRoutes
};
