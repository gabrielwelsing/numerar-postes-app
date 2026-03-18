require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Configuração do CORS
// O Railway exige CORS para que o frontend (em outro domínio) possa acessar
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Configuração do Pool de Conexão com PostgreSQL
let pool;
if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
} else {
    console.warn("AVISO: Variável DATABASE_URL não definida.");
}

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

app.listen(port, () => {
    console.log(`Backend escutando na porta ${port}`);
});