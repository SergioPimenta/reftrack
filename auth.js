const jwt = require('jsonwebtoken');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

function authenticateToken(req, res, next) {
    const token = req.cookies.token;

    if (!token) return res.status(401).json({ error: 'Acesso negado. Nenhum token fornecido.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido ou expirado.' });

        req.user = user;
        next();
    });
}

const authRoutes = require('express').Router();

authRoutes.post('/login', (req, res) => {
    const { usuario, senha } = req.body;

    if (usuario === ADMIN_USER && senha === ADMIN_PASS) {
        const token = jwt.sign({ username: usuario, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });

        // Configura o cookie httpOnly
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000 // 8 horas
        });

        res.json({ message: 'Login bem-sucedido.' });
    } else {
        res.status(401).json({ error: 'Credenciais inválidas.' });
    }
});

authRoutes.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logout bem-sucedido.' });
});

module.exports = {
    authenticateToken,
    authRoutes
};
