const express = require('express');
const db = require('../database');
const router = express.Router();

let ultimosLogs = [];

router.post('/', (req, res) => {
    // Retorna 200 imediatamente para o Hotmart não ficar aguardando
    res.status(200).send('OK');

    try {
        const payload = req.body;

        // Apenas guardando o log para o front (últimos 10)
        ultimosLogs.unshift({
            data: new Date().toISOString(),
            evento: payload.event || 'N/A',
            transaction: payload.data?.purchase?.transaction || 'N/A'
        });
        if (ultimosLogs.length > 10) ultimosLogs.pop();

        // Processamento do payload padrão Hotmart (simplificado)
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

        // Se veio um src (e-mail do indicador), tenta encontrar no banco
        if (src) {
            const indicador = db.prepare('SELECT id, comissao_percentual FROM indicadores WHERE email = ?').get(src);
            if (indicador) {
                indicadorId = indicador.id;

                // Calcula comissão apenas se a venda foi aprovada
                if (status === 'APPROVED') {
                    comissao = (price * indicador.comissao_percentual) / 100;
                }
            }
        }

        // Insere ou ignora a venda baseada no transaction_id
        // Se o status mudar (ex: PENDING -> APPROVED), na vida real faríamos um UPSERT
        // Vamos fazer um UPSERT (INSERT OR REPLACE ou ON CONFLICT DO UPDATE)
        const upsertQuery = `
      INSERT INTO vendas (indicador_id, transaction_id, produto_nome, comprador_email, comprador_nome, valor, comissao_valor, status, src_recebido)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(transaction_id) DO UPDATE SET
        status = excluded.status,
        comissao_valor = excluded.comissao_valor,
        indicador_id = excluded.indicador_id
    `;

        db.prepare(upsertQuery).run(
            indicadorId, transactionId, produtoNome, compradorEmail, compradorNome, price, comissao, status, src
        );

    } catch (error) {
        console.error('Erro processando webhook', error);
    }
});

// Endpoint só pra nossa tela consultar os últimos logs em memória
router.get('/logs', (req, res) => {
    res.json(ultimosLogs);
});

module.exports = router;
