const express = require('express');
const db = require('../database');

const vendasRoutes = express.Router();
const statsRoutes = express.Router();

// GET /api/vendas
vendasRoutes.get('/', (req, res) => {
    const indicadorId = req.query.indicador_id;
    const status = req.query.status;

    let query = `
    SELECT v.*, i.nome as indicador_nome, i.email as indicador_email
    FROM vendas v
    LEFT JOIN indicadores i ON v.indicador_id = i.id
    WHERE 1=1
  `;
    const params = [];

    if (indicadorId) {
        query += ' AND v.indicador_id = ?';
        params.push(indicadorId);
    }

    if (status) {
        query += ' AND v.status = ?';
        params.push(status);
    }

    query += ' ORDER BY v.data_venda DESC'; // Default limit 50 for this demo

    try {
        const vendas = db.prepare(query).all(...params);
        res.json(vendas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stats
statsRoutes.get('/', (req, res) => {
    try {
        // 1. Total Vendas (Aprovadas)
        const totalVendas = db.prepare('SELECT COUNT(*) as count FROM vendas WHERE status = ?').get('APPROVED').count;

        // 2. Total Receita (Aprovadas)
        const totalReceita = db.prepare('SELECT SUM(valor) as total FROM vendas WHERE status = ?').get('APPROVED').total || 0;

        // 3. Total Comissões (Aprovadas)
        const totalComissoes = db.prepare('SELECT SUM(comissao_valor) as total FROM vendas WHERE status = ?').get('APPROVED').total || 0;

        // 4. Indicadores Ativos
        const indicadoresAtivos = db.prepare('SELECT COUNT(*) as count FROM indicadores WHERE ativo = 1').get().count;

        // 5. Ranking de Indicadores (Mês Corrente)
        const rankingQuery = `
      SELECT i.id, i.nome, i.email,
             COUNT(v.id) as vendas_aprovadas,
             SUM(v.comissao_valor) as comissoes_geradas
      FROM indicadores i
      LEFT JOIN vendas v ON i.id = v.indicador_id
      WHERE v.status = 'APPROVED'
        AND strftime('%Y-%m', v.data_venda) = strftime('%Y-%m', 'now')
      GROUP BY i.id
      ORDER BY vendas_aprovadas DESC
      LIMIT 10
    `;
        const ranking = db.prepare(rankingQuery).all();

        // 6. Vendas por Semana (Últimas 8 semanas)
        const semanasQuery = `
      SELECT 
        strftime('%Y-%W', data_venda) as semana,
        COUNT(*) as total_vendas
      FROM vendas
      WHERE status = 'APPROVED'
      GROUP BY semana
      ORDER BY semana DESC
      LIMIT 8
    `;
        const vendasPorSemana = db.prepare(semanasQuery).all().reverse();

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
