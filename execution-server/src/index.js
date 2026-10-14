require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { requireAuth } = require('./middleware/auth');
const runRouter = require('./routes/run');

const app = express();
const PORT = process.env.PORT || 4000;

/**
 * Validates security constraints before startup.
 * The server MUST refuse to start if NODE_ENV === 'production' and ALLOW_TEST_AUTH is set.
 */
function validateServerEnvironment() {
    if (
        process.env.NODE_ENV === 'production' &&
        (process.env.ALLOW_TEST_AUTH === 'true' || process.env.ALLOW_TEST_AUTH === '1')
    ) {
        throw new Error('FATAL: Refusing to start in production with ALLOW_TEST_AUTH enabled.');
    }
}

// ── CORS configuration: defaults to DENY when no origins are configured ──
const CORS_ORIGINS = process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        // Requests without Origin header (e.g. server-to-server, curl, local health checks) are allowed
        if (!origin) {
            return callback(null, true);
        }
        // If an Origin header is sent and no origins are configured, default to DENY
        if (allowedOrigins.length === 0) {
            return callback(new Error('CORS denied: no allowed origins configured.'));
        }
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`Origin "${origin}" not allowed by CORS policy.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Body limit (2MB) with graceful 413 error handling
const BODY_LIMIT = process.env.BODY_LIMIT || '2mb';
app.use(express.json({ limit: BODY_LIMIT }));

// Handle JSON body parse errors (e.g. payload too large)
app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            error: `Payload too large. Maximum body size is ${BODY_LIMIT}.`,
        });
    }
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Malformed JSON payload.' });
    }
    next(err);
});

const { getConcurrencyStats } = require('./middleware/concurrency');

// Health check endpoint (public for orchestrators / health monitoring)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        concurrency: getConcurrencyStats(),
    });
});

// Protect /api/run and every other route with Supabase access-token authentication
app.use('/api', requireAuth);
app.use('/api/run', runRouter);

// Fallback 404 handler for unknown routes
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    if (err.message && err.message.includes('CORS')) {
        return res.status(403).json({ error: err.message });
    }
    console.error('[server error]', err);
    res.status(500).json({ error: 'Internal server error' });
});

const { startupReaper, startReaperInterval } = require('./utils/reaper');

if (require.main === module && process.env.NODE_ENV !== 'test') {
    validateServerEnvironment();
    app.listen(PORT, () => {
        console.log(`🚀 CollabSpace Execution Server running on port ${PORT}`);
        console.log(`   Allowed origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'NONE (DENY ALL)'}`);
        console.log(`   Java image:   ${process.env.JAVA_IMAGE || 'collabspace-java'}`);
        console.log(`   Python image: ${process.env.PYTHON_IMAGE || 'collabspace-python'}`);
        console.log(`   Timeout:      ${process.env.EXECUTION_TIMEOUT_MS || 8000}ms`);

        // Initialize Docker container reaper
        startupReaper().catch(() => {});
        startReaperInterval(60 * 1000);
    });
}

module.exports = app;
module.exports.validateServerEnvironment = validateServerEnvironment;
module.exports.allowedOrigins = allowedOrigins;
