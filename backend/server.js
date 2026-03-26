require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    /\.railway\.app$/
];
app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        const isAllowed = allowedOrigins.some(o => o instanceof RegExp ? o.test(origin) : o === origin);
        if (isAllowed) callback(null, true);
        else callback(new Error('Bloqueado pela política de CORS'));
    },
    credentials: true
}));
app.use(express.json());

// Pool do banco PRÓPRIO do app — rotas de funcionalidade
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false
});

// Pool do banco do HUB — usado APENAS para validar token_version
const hubPool = new Pool({
    connectionString: process.env.HUB_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Rotas de Teste
app.get('/', (req, res) => res.json({ message: "Servidor Ativo" }));

app.get('/api/health', async (req, res) => {
    try {
        let dbStatus = "Não configurado";
        if (pool) {
            const client = await pool.connect();
            const result = await client.query('SELECT NOW()');
            client.release();
            dbStatus = "Conectado. Hora do BD: " + result.rows[0].now;
        }
        res.status(200).json({ status: "OK", database: dbStatus, timestamp: new Date() });
    } catch (err) {
        console.error('Erro de BD:', err);
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// =============================
// VALIDAÇÃO DE TOKEN DO HUB
// Checa assinatura JWT + token_version no banco
// Se o usuário deslogou do hub, token_version foi incrementado
// e esse endpoint rejeita na hora — acesso bloqueado instantaneamente
// =============================
app.get('/api/auth/validate', async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Token ausente' });

    const token = auth.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Consulta token_version atual no banco do hub
        const result = await hubPool.query(
            `SELECT token_version FROM users WHERE id = $1`,
            [decoded.user_id]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        // token_version diferente = usuário deslogou do hub
        if (user.token_version !== decoded.token_version) {
            return res.status(401).json({ error: 'Sessão encerrada' });
        }

        res.json({ ok: true, user: decoded });

    } catch (err) {
        res.status(401).json({ error: 'Token inválido ou expirado' });
    }
});

app.listen(port, () => {
    console.log(`Backend escutando na porta ${port}`);
});
