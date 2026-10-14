const crypto = require('crypto');

// In-memory token verification cache: SHA-256(token) -> { user, expiresAt }
// NOTE: Cache keys are cryptographically hashed tokens, never raw tokens
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
 * Hash token using SHA-256 to ensure raw tokens are never retained as cache keys.
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Clean expired entries from token cache
 */
function pruneCache() {
    const now = Date.now();
    for (const [key, data] of tokenCache.entries()) {
        if (data.expiresAt <= now) {
            tokenCache.delete(key);
        }
    }
}
setInterval(pruneCache, 5 * 60 * 1000).unref();

/**
 * Verifies a JWT signed with HMAC-SHA256.
 *
 * Enforces:
 *  - Explicit alg check (strictly HS256; rejects none and unexpected algorithms)
 *  - Constant-time signature comparison with crypto.timingSafeEqual
 *  - exp (expiration)
 *  - nbf (not before)
 *  - aud (audience: default "authenticated" for Supabase access tokens)
 *  - iss (issuer if configured)
 *
 * @param {string} token
 * @param {string} secret
 * @param {object} [options]
 * @returns {object} Decoded payload
 */
function verifyJwtSecret(token, secret, options = {}) {
    if (!token || typeof token !== 'string') {
        throw new Error('Token is required');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Malformed JWT: must contain 3 parts');
    }
    const [headerB64, payloadB64, signatureB64] = parts;

    let header;
    try {
        header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    } catch {
        throw new Error('Malformed JWT header');
    }

    // 1. Explicit algorithm validation: strictly HS256, reject 'none'
    if (!header || !header.alg || typeof header.alg !== 'string') {
        throw new Error('Missing JWT algorithm');
    }

    const alg = header.alg.trim();
    if (alg.toLowerCase() === 'none') {
        throw new Error('JWT algorithm "none" is strictly forbidden');
    }
    if (alg !== 'HS256') {
        throw new Error(`Unsupported JWT algorithm "${alg}". Only HS256 is accepted.`);
    }

    // 2. Verify HMAC-SHA256 signature with constant-time comparison
    const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

    const sigBuf = Buffer.from(signatureB64);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new Error('Invalid JWT signature');
    }

    let payload;
    try {
        payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
        throw new Error('Malformed JWT payload');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    // 3. Expiration claim check (exp)
    if (typeof payload.exp !== 'number' || payload.exp < nowSeconds) {
        throw new Error('JWT has expired');
    }

    // 4. Not before claim check (nbf)
    if (payload.nbf && typeof payload.nbf === 'number' && payload.nbf > nowSeconds) {
        throw new Error('JWT is not active yet (nbf)');
    }

    // 5. Audience claim check (aud)
    const expectedAudience = options.audience || process.env.SUPABASE_JWT_AUDIENCE || 'authenticated';
    if (payload.aud !== expectedAudience) {
        throw new Error(`Invalid JWT audience: expected "${expectedAudience}", got "${payload.aud}"`);
    }

    // 6. Issuer claim check (iss) if expectedIssuer configured
    const expectedIssuer = options.issuer || process.env.SUPABASE_JWT_ISSUER;
    if (expectedIssuer && payload.iss !== expectedIssuer) {
        throw new Error(`Invalid JWT issuer: expected "${expectedIssuer}", got "${payload.iss}"`);
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

        // Test mode bypass exists STRICTLY when NODE_ENV === 'test'
        if (
            process.env.NODE_ENV === 'test' &&
            (process.env.ALLOW_TEST_AUTH === 'true' || process.env.ALLOW_TEST_AUTH === '1') &&
            token.startsWith('test-token')
        ) {
            const userId = token.split(':')[1] || 'test-user-id';
            req.user = { id: userId, email: `${userId}@test.local` };
            req.userId = userId;
            return next();
        }

        // Check memory cache using SHA-256 hash of token as key (never store raw token)
        const cacheKey = hashToken(token);
        const cached = tokenCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            req.user = cached.user;
            req.userId = cached.user.id || cached.user.sub;
            return next();
        }

        const { supabaseUrl, supabaseAnonKey, supabaseJwtSecret } = getAuthConfig();
        let user;

        // Path 1: Local JWT secret verification (preferred for performance and offline reliability)
        if (supabaseJwtSecret) {
            const payload = verifyJwtSecret(token, supabaseJwtSecret);
            user = {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
                ...payload,
            };
        } else if (supabaseUrl && supabaseAnonKey) {
            // Path 2: Supabase Auth REST verification (used when JWT secret is not configured)
            user = await verifyWithSupabase(token);
        } else {
            console.error('[auth] Neither SUPABASE_JWT_SECRET nor SUPABASE_URL/ANON_KEY is configured.');
            return res.status(500).json({
                error: 'Server auth configuration error.',
            });
        }

        // Cache the verified user by token hash
        tokenCache.set(cacheKey, {
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
    hashToken,
    tokenCache,
};
