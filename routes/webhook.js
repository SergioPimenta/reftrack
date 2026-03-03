const express = require('express');
const db = require('../database');
const router = express.Router();

let ultimosLogs = [];

router.post('/', async (req, res) => {
    // Retorna 200 imediatamente para o Hotmart não ficar aguardando
    res.status(200).send('OK');

    try {
        const payload = req.body;

        // Guardar para front
        ultimosLogs.unshift({
            data: new Date().toISOString(),
            evento: payload.event || 'N/A',
            transaction: payload.data?.purchase?.transaction || 'N/A'
        });
        if (ultimosLogs.length > 10) ultimosLogs.pop();

        if (!payload.data || !payload.data.purchase) return;

        const purchase = payload.data.purchase;
        const buyer = payload.data.buyer || {};
        const product = payload.data.product || {};

        const transactionId = purchase.transaction;
        const status = purchase.status;
        const price = purchase.price?.value || 0;
        const src = purchase.tracking?.source || '';

        const compradorEmail = buyer.email || '';
        const compradorNome = buyer.name || '';
        const produtoNome = product.name || '';

        let indicadorId = null;
        let comissao = 0;

        if (src) {
            const resInd = await db.query('SELECT id, comissao_percentual FROM indicadores WHERE email = $1', [src]);
            if (resInd.rows.length > 0) {
                const indicador = resInd.rows[0];
                indicadorId = indicador.id;

                if (status === 'APPROVED') {
                    comissao = (price * indicador.comissao_percentual) / 100;
                }
            }
        }

        // Postgres UPSERT: INSERT ... ON CONFLICT DO UPDATE
        const upsertQuery = `
      INSERT INTO vendas (indicador_id, transaction_id, produto_nome, comprador_email, comprador_nome, valor, comissao_valor, status, src_recebido)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT(transaction_id) DO UPDATE SET
        status = EXCLUDED.status,
        comissao_valor = EXCLUDED.comissao_valor,
        indicador_id = EXCLUDED.indicador_id
    `;

        await db.query(upsertQuery, [indicadorId, transactionId, produtoNome, compradorEmail, compradorNome, price, comissao, status, src]);

    } catch (error) {
        console.error('Erro processando webhook', error);
    }
});

router.get('/logs', (req, res) => {
    res.json(ultimosLogs);
});

module.exports = router;
