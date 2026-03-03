const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const express = require('express');
const db = require('./database');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const authRoutes = express.Router();

authRoutes.post('/login', async (req, res) => {
    const { usuario, senha } = req.body;

    try {
        // Tenta garantir que o DB existe antes de logar. (Útil no 1º cold-boot do Vercel Serverless)
        if (process.env.DATABASE_URL) {
            await db.initDb();
        }

        const result = await db.query('SELECT * FROM usuarios WHERE usuario = $1', [usuario]);

        if (result.rows.length === 0) {
            const allUsers = await db.query('SELECT id, usuario FROM usuarios');
            console.log('Login falhou para', usuario, '. Usuarios no DB:', allUsers.rows);
            return res.status(401).json({ error: 'Usuário não encontrado no banco.' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(senha, user.senha);

        if (isMatch) {
            const token = jwt.sign({ id: user.id, username: user.usuario, role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });

            res.cookie('auth_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 12 * 60 * 60 * 1000 // 12 hours
            });

            return res.json({ message: 'Login bem-sucedido', nome: user.nome });
        } else {
            return res.status(401).json({ error: 'Senha incorreta para o usuário admin.' });
        }
    } catch (error) {
        console.error('Erro no login', error);
        res.status(500).json({ error: 'Erro de DB: ' + error.message });
    }
});

authRoutes.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    return res.json({ message: 'Logout efetuado com sucesso.' });
});

// Middleware
function authenticateToken(req, res, next) {
    const token = req.cookies.auth_token;

    if (!token) {
        return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido ou expirado.' });
        req.user = user;
        next();
    });
}

module.exports = {
    authRoutes,
    authenticateToken
};
