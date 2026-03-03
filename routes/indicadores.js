const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/indicadores - lista todos os ativos (e os inativos se precisar, mas vamos listar todos com flag)
router.get('/', (req, res) => {
    try {
        const indicadores = db.prepare('SELECT * FROM indicadores ORDER BY nome ASC').all();
        res.json(indicadores);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/indicadores - cadastra novo
router.post('/', (req, res) => {
    const { nome, email, comissao_percentual } = req.body;

    if (!nome || !email) {
        return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
    }

    try {
        const comissao = comissao_percentual ? parseFloat(comissao_percentual) : 10;

        const stmt = db.prepare('INSERT INTO indicadores (nome, email, comissao_percentual) VALUES (?, ?, ?)');
        const info = stmt.run(nome, email, comissao);

        const novoIndicador = db.prepare('SELECT * FROM indicadores WHERE id = ?').get(info.lastInsertRowid);
        res.status(201).json(novoIndicador);
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed: indicadores.email')) {
            return res.status(400).json({ error: 'Email já cadastrado.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/indicadores/:id - edita
router.put('/:id', (req, res) => {
    const id = req.params.id;
    const { nome, email, comissao_percentual, ativo } = req.body;

    try {
        const stmt = db.prepare(`
      UPDATE indicadores 
      SET nome = COALESCE(?, nome),
          email = COALESCE(?, email),
          comissao_percentual = COALESCE(?, comissao_percentual),
          ativo = COALESCE(?, ativo)
      WHERE id = ?
    `);

        // Convert undefined to null for COALESCE to work properly
        stmt.run(
            nome !== undefined ? nome : null,
            email !== undefined ? email : null,
            comissao_percentual !== undefined ? parseFloat(comissao_percentual) : null,
            ativo !== undefined ? (ativo ? 1 : 0) : null,
            id
        );

        const atualizado = db.prepare('SELECT * FROM indicadores WHERE id = ?').get(id);
        if (!atualizado) return res.status(404).json({ error: 'Indicador não encontrado.' });

        res.json(atualizado);
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email já cadastrado.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/indicadores/:id - desativa (soft delete)
router.delete('/:id', (req, res) => {
    const id = req.params.id;

    try {
        const stmt = db.prepare('UPDATE indicadores SET ativo = 0 WHERE id = ?');
        const info = stmt.run(id);

        if (info.changes === 0) return res.status(404).json({ error: 'Indicador não encontrado.' });

        res.json({ message: 'Indicador desativado com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
