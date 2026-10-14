require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { requireAuth } = require('./middleware/auth');
const runRouter = require('./routes/run');

const app = express();
const PORT = process.env.PORT || 4000;

// ── CORS configuration with allowlist from env ──
const CORS_ORIGINS = process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000';
const allowedOrigins = CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) or in allowlist
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`Origin "${origin}" not allowed by CORS policy.`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint (public for orchestrators / health monitoring)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Protect /api/run and every other route with Supabase access-token authentication
app.use('/api', requireAuth);
app.use('/api/run', runRouter);

// Fallback 404 handler for unknown routes
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    if (err.message && err.message.includes('CORS policy')) {
        return res.status(403).json({ error: err.message });
    }
    console.error('[server error]', err);
    res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`🚀 CollabSpace Execution Server running on port ${PORT}`);
        console.log(`   Allowed origins: ${allowedOrigins.join(', ')}`);
        console.log(`   Java image:   ${process.env.JAVA_IMAGE || 'collabspace-java'}`);
        console.log(`   Python image: ${process.env.PYTHON_IMAGE || 'collabspace-python'}`);
        console.log(`   Timeout:      ${process.env.EXECUTION_TIMEOUT_MS || 8000}ms`);
    });
}

module.exports = app;
