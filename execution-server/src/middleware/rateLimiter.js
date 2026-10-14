// ── Rate Limiter ─────────────────────────────────────────────────────────────
// Sliding window rate limiter per user (or IP fallback).
// Returns 429 + Retry-After header when limit is exceeded.

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '20', 10);                 // 20 requests/min

// Map: userId -> Array of timestamps (ms)
const requestLogs = new Map();

/**
 * Prune old entries every 5 minutes to prevent memory leak
 */
setInterval(() => {
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    for (const [key, timestamps] of requestLogs.entries()) {
        const fresh = timestamps.filter(t => t > cutoff);
        if (fresh.length === 0) {
            requestLogs.delete(key);
        } else {
            requestLogs.set(key, fresh);
        }
    }
}, 5 * 60 * 1000).unref();

function rateLimiter(req, res, next) {
    const key = req.userId || req.ip || 'anonymous';
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    let timestamps = requestLogs.get(key) || [];
    // Retain only timestamps within the current sliding window
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= RATE_LIMIT_MAX) {
        const oldest = timestamps[0];
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000));

        res.setHeader('Retry-After', retryAfterSeconds);
        res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil((oldest + RATE_LIMIT_WINDOW_MS) / 1000));

        return res.status(429).json({
            error: 'Too many execution requests. Please wait before submitting again.',
            retryAfter: retryAfterSeconds,
        });
    }

    timestamps.push(now);
    requestLogs.set(key, timestamps);

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - timestamps.length));

    next();
}

/**
 * Reset helper for testing
 */
function resetRateLimiter() {
    requestLogs.clear();
}

module.exports = {
    rateLimiter,
    resetRateLimiter,
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX,
};
