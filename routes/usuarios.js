const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');

// GET /api/usuarios - lista todos os usuarios
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT id, nome, usuario, criado_em FROM usuarios ORDER BY nome ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/usuarios - cadastra novo usuario
router.post('/', async (req, res) => {
    const { nome, usuario, senha } = req.body;

    if (!nome || !usuario || !senha) {
        return res.status(400).json({ error: 'Nome, usuário e senha são obrigatórios.' });
    }

    try {
        const hash = await bcrypt.hash(senha, 10);

        const result = await db.query(
            'INSERT INTO usuarios (nome, usuario, senha) VALUES ($1, $2, $3) RETURNING id, nome, usuario, criado_em',
            [nome, usuario, hash]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.message.includes('unique constraint') || err.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Nome de usuário (login) já cadastrado.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/usuarios/:id - edita usuario (apenas nome e usuario, senha condicional)
router.put('/:id', async (req, res) => {
    const id = req.params.id;
    const { nome, usuario, senha } = req.body;

    try {
        let query;
        let params;

        if (senha) {
            const hash = await bcrypt.hash(senha, 10);
            query = `
        UPDATE usuarios 
        SET nome = COALESCE($1, nome),
            usuario = COALESCE($2, usuario),
            senha = $3
        WHERE id = $4
        RETURNING id, nome, usuario, criado_em
      `;
            params = [
                nome !== undefined ? nome : null,
                usuario !== undefined ? usuario : null,
                hash,
                id
            ];
        } else {
            query = `
        UPDATE usuarios 
        SET nome = COALESCE($1, nome),
            usuario = COALESCE($2, usuario)
        WHERE id = $3
        RETURNING id, nome, usuario, criado_em
      `;
            params = [
                nome !== undefined ? nome : null,
                usuario !== undefined ? usuario : null,
                id
            ];
        }

        const result = await db.query(query, params);

        if (result.rowCount === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

        res.json(result.rows[0]);
    } catch (err) {
        if (err.message.includes('unique constraint')) {
            return res.status(400).json({ error: 'Nome de usuário (login) já cadastrado.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/usuarios/:id - exclui usuario (HARD DELETE)
router.delete('/:id', async (req, res) => {
    const id = req.params.id;

    try {
        // Previne auto exclusao (nao vai dar erro pra fins praticos do admin)
        const result = await db.query('DELETE FROM usuarios WHERE id = $1', [id]);

        if (result.rowCount === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

        res.json({ message: 'Usuário excluído com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
