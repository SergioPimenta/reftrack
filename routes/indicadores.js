const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/indicadores - lista todos
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM indicadores ORDER BY nome ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/indicadores - cadastra novo
router.post('/', async (req, res) => {
    const { nome, email, comissao_percentual } = req.body;

    if (!nome || !email) {
        return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
    }

    try {
        const comissao = comissao_percentual ? parseFloat(comissao_percentual) : 10;

        const result = await db.query(
            'INSERT INTO indicadores (nome, email, comissao_percentual) VALUES ($1, $2, $3) RETURNING *',
            [nome, email, comissao]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.message.includes('unique constraint') || err.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Email já cadastrado.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/indicadores/:id - edita
router.put('/:id', async (req, res) => {
    const id = req.params.id;
    const { nome, email, comissao_percentual, ativo } = req.body;

    try {
        const result = await db.query(`
      UPDATE indicadores 
      SET nome = COALESCE($1, nome),
          email = COALESCE($2, email),
          comissao_percentual = COALESCE($3, comissao_percentual),
          ativo = COALESCE($4, ativo)
      WHERE id = $5
      RETURNING *
    `, [
            nome !== undefined ? nome : null,
            email !== undefined ? email : null,
            comissao_percentual !== undefined ? parseFloat(comissao_percentual) : null,
            ativo !== undefined ? (ativo ? 1 : 0) : null,
            id
        ]);

        if (result.rowCount === 0) return res.status(404).json({ error: 'Indicador não encontrado.' });

        res.json(result.rows[0]);
    } catch (err) {
        if (err.message.includes('unique constraint')) {
            return res.status(400).json({ error: 'Email já cadastrado.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/indicadores/:id - desativa (soft delete)
router.delete('/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const result = await db.query('UPDATE indicadores SET ativo = 0 WHERE id = $1', [id]);

        if (result.rowCount === 0) return res.status(404).json({ error: 'Indicador não encontrado.' });

        res.json({ message: 'Indicador desativado com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
