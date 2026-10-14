const crypto = require('crypto');

// In-memory token verification cache: token -> { user, expiresAt }
const tokenCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

function getAuthConfig() {
    return {
        supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
        supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
    };
}

/**
 * Clean expired entries from token cache
 */
function pruneCache() {
    const now = Date.now();
    for (const [token, data] of tokenCache.entries()) {
        if (data.expiresAt <= now) {
            tokenCache.delete(token);
        }
    }
}
setInterval(pruneCache, 5 * 60 * 1000).unref();

/**
 * Verifies a JWT signed with HMAC-SHA256 using the provided secret.
 * @param {string} token
 * @param {string} secret
 * @returns {object} Decoded payload
 */
function verifyJwtSecret(token, secret) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Malformed JWT');
    }
    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify HMAC-SHA256 signature
    const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

    const sigBuf = Buffer.from(signatureB64);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new Error('Invalid JWT signature');
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
        throw new Error('JWT has expired');
    }

    return payload;
}

/**
 * Verifies a Supabase access token via Supabase Auth REST endpoint.
 * @param {string} token
 * @returns {Promise<object>} Supabase user object
 */
async function verifyWithSupabase(token) {
    const { supabaseUrl, supabaseAnonKey } = getAuthConfig();
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase URL or Anon Key is not configured on server.');
    }

    const url = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': supabaseAnonKey,
        },
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Supabase auth rejected token (${response.status}): ${errorBody}`);
    }

    const user = await response.json();
    return user;
}

/**
 * Supabase Access-Token Auth Middleware.
 * Required on /api/run and every protected route.
 */
async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || typeof authHeader !== 'string') {
            return res.status(401).json({
                error: 'Unauthorized: Missing Authorization header.',
            });
        }

        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (!match) {
            return res.status(401).json({
                error: 'Unauthorized: Invalid Authorization header format. Expected "Bearer <token>".',
            });
        }

        const token = match[1].trim();
        if (!token) {
            return res.status(401).json({
                error: 'Unauthorized: Token is empty.',
            });
        }

        // Test mode bypass for test tokens
        if (
            (process.env.NODE_ENV === 'test' || process.env.ALLOW_TEST_AUTH === 'true') &&
            token.startsWith('test-token')
        ) {
            const userId = token.split(':')[1] || 'test-user-id';
            req.user = { id: userId, email: `${userId}@test.local` };
            req.userId = userId;
            return next();
        }

        // Check memory cache first
        const cached = tokenCache.get(token);
        if (cached && cached.expiresAt > Date.now()) {
            req.user = cached.user;
            req.userId = cached.user.id || cached.user.sub;
            return next();
        }

        const { supabaseUrl, supabaseAnonKey, supabaseJwtSecret } = getAuthConfig();
        let user;

        // Verify via JWT secret if available
        if (supabaseJwtSecret) {
            const payload = verifyJwtSecret(token, supabaseJwtSecret);
            user = {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
                ...payload,
            };
        } else if (supabaseUrl && supabaseAnonKey) {
            // Otherwise verify with Supabase Auth endpoint
            user = await verifyWithSupabase(token);
        } else {
            console.error('[auth] Neither SUPABASE_JWT_SECRET nor SUPABASE_URL/ANON_KEY is configured.');
            return res.status(500).json({
                error: 'Server auth configuration error.',
            });
        }

        // Cache the verified user
        tokenCache.set(token, {
            user,
            expiresAt: Date.now() + CACHE_TTL_MS,
        });

        req.user = user;
        req.userId = user.id || user.sub;
        next();
    } catch (err) {
        console.warn('[auth] Verification failed:', err.message);
        return res.status(401).json({
            error: `Unauthorized: ${err.message}`,
        });
    }
}

module.exports = {
    requireAuth,
    verifyJwtSecret,
    verifyWithSupabase,
    tokenCache,
};
