const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const jwt = require('jsonwebtoken'); // Need jwt from the library early or directly in auth

const { authRoutes, authenticateToken } = require('./auth');
const indicadoresRoutes = require('./routes/indicadores');
const vendasRoutes = require('./routes/vendas');
const webhookRoutes = require('./routes/webhook');
const usuariosRoutes = require('./routes/usuarios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());

// Static files (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', authRoutes); // /api/login, /api/logout
app.use('/api/indicadores', authenticateToken, indicadoresRoutes);
app.use('/api/usuarios', authenticateToken, usuariosRoutes);
app.use('/api/vendas', authenticateToken, vendasRoutes.vendasRoutes);
app.use('/api/stats', authenticateToken, vendasRoutes.statsRoutes);
app.use('/api/webhook/hotmart', webhookRoutes);

// Config endpoint para frontend puxar variáveis não sensíveis (como a URL do produto)
app.get('/api/config', authenticateToken, (req, res) => {
    res.json({
        hotmartProductUrl: process.env.HOTMART_PRODUCT_URL || 'https://sua-pagina-de-vendas.com'
    });
});

// Fallback to index.html for SPA router
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`RefTrack Server running on port ${PORT}`);
    });
}

// Export para Vercel Serverless
module.exports = app;
