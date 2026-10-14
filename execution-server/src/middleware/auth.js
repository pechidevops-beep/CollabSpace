const crypto = require('crypto');
const jose = require('jose');

// In-memory token verification cache: SHA-256(token) -> { user, expiresAt }
// NOTE: Cache keys are cryptographically hashed tokens, never raw tokens
const tokenCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

// Cached remote JWKS set instance
let remoteJWKS = null;
let currentJwksUrl = null;

function getAuthConfig() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const jwksUrl = process.env.SUPABASE_JWKS_URL ||
        (supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json` : null);

    return {
        supabaseUrl,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
        supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
        supabaseJwksUrl: jwksUrl,
        // Mode: 'secret' | 'jwks' | 'supabase_api'
        authMode: process.env.JWT_AUTH_MODE ||
            (process.env.SUPABASE_JWT_SECRET ? 'secret' : (jwksUrl ? 'jwks' : 'supabase_api')),
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
 * Get or initialize cached remote JWKS set
 */
function getRemoteJWKS(url) {
    if (!remoteJWKS || currentJwksUrl !== url) {
        remoteJWKS = jose.createRemoteJWKSet(new URL(url));
        currentJwksUrl = url;
    }
    return remoteJWKS;
}

/**
 * Validates header before full signature verification.
 * Explicitly rejects alg: 'none' (case-insensitive) and unexpected algorithms.
 */
function validateProtectedHeader(token, allowedAlgs) {
    let header;
    try {
        header = jose.decodeProtectedHeader(token);
    } catch {
        throw new Error('Malformed JWT header');
    }

    if (!header || !header.alg || typeof header.alg !== 'string') {
        throw new Error('Missing JWT algorithm');
    }

    const alg = header.alg.trim();
    if (alg.toLowerCase() === 'none') {
        throw new Error('JWT algorithm "none" is strictly forbidden');
    }

    if (!allowedAlgs.includes(alg)) {
        throw new Error(`Unsupported JWT algorithm "${alg}". Expected one of: ${allowedAlgs.join(', ')}`);
    }

    return header;
}

/**
 * Verifies a JWT signed with HMAC-SHA256 using jose.
 *
 * @param {string} token
 * @param {string} secret
 * @param {object} [options]
 * @returns {Promise<object>} Decoded payload
 */
async function verifyJwtSecret(token, secret, options = {}) {
    if (!token || typeof token !== 'string') {
        throw new Error('Token is required');
    }
    if (!secret || typeof secret !== 'string') {
        throw new Error('Secret is required');
    }

    // 1. Explicit alg check (rejects none and unexpected algorithms)
    validateProtectedHeader(token, ['HS256']);

    const secretKey = new TextEncoder().encode(secret);
    const expectedAudience = options.audience || process.env.SUPABASE_JWT_AUDIENCE || 'authenticated';
    const expectedIssuer = options.issuer || process.env.SUPABASE_JWT_ISSUER;

    try {
        const verifyOptions = {
            algorithms: ['HS256'],
            audience: expectedAudience,
        };
        if (expectedIssuer) {
            verifyOptions.issuer = expectedIssuer;
        }

        const { payload } = await jose.jwtVerify(token, secretKey, verifyOptions);
        return payload;
    } catch (err) {
        if (err.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
            throw new Error('Invalid JWT signature');
        }
        if (err.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
            if (err.claim === 'aud') {
                throw new Error(`Invalid JWT audience: expected "${expectedAudience}", got "${err.payload?.aud}"`);
            }
            if (err.claim === 'iss') {
                throw new Error(`Invalid JWT issuer: expected "${expectedIssuer}", got "${err.payload?.iss}"`);
            }
            if (err.claim === 'nbf') {
                throw new Error('JWT is not active yet (nbf)');
            }
        }
        if (err.code === 'ERR_JWT_EXPIRED') {
            throw new Error('JWT has expired');
        }
        throw new Error(err.message || 'JWT verification failed');
    }
}

/**
 * Verifies a JWT signed asymmetrically via JWKS using jose.
 *
 * @param {string} token
 * @param {string|Function} jwksSource - JWKS URL string, or a jose JWKS function (e.g. createLocalJWKSet)
 * @param {object} [options]
 * @returns {Promise<object>} Decoded payload
 */
async function verifyJwtWithJwks(token, jwksSource, options = {}) {
    if (!token || typeof token !== 'string') {
        throw new Error('Token is required');
    }
    if (!jwksSource) {
        throw new Error('JWKS source is required');
    }

    const allowedAlgs = options.algorithms || ['RS256', 'ES256'];
    validateProtectedHeader(token, allowedAlgs);

    const jwksResolver = typeof jwksSource === 'string' ? getRemoteJWKS(jwksSource) : jwksSource;
    const expectedAudience = options.audience || process.env.SUPABASE_JWT_AUDIENCE || 'authenticated';
    const expectedIssuer = options.issuer || process.env.SUPABASE_JWT_ISSUER;

    try {
        const verifyOptions = {
            algorithms: allowedAlgs,
            audience: expectedAudience,
        };
        if (expectedIssuer) {
            verifyOptions.issuer = expectedIssuer;
        }

        const { payload } = await jose.jwtVerify(token, jwksResolver, verifyOptions);
        return payload;
    } catch (err) {
        if (err.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
            throw new Error('Invalid JWT signature');
        }
        if (err.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
            if (err.claim === 'aud') {
                throw new Error(`Invalid JWT audience: expected "${expectedAudience}", got "${err.payload?.aud}"`);
            }
            if (err.claim === 'iss') {
                throw new Error(`Invalid JWT issuer: expected "${expectedIssuer}", got "${err.payload?.iss}"`);
            }
            if (err.claim === 'nbf') {
                throw new Error('JWT is not active yet (nbf)');
            }
        }
        if (err.code === 'ERR_JWT_EXPIRED') {
            throw new Error('JWT has expired');
        }
        throw new Error(err.message || 'JWKS verification failed');
    }
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

        const authConfig = getAuthConfig();
        let user;

        if (authConfig.authMode === 'jwks' && authConfig.supabaseJwksUrl) {
            // Path 1: Asymmetric JWKS verification via jose
            const payload = await verifyJwtWithJwks(token, authConfig.supabaseJwksUrl);
            user = {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
                ...payload,
            };
        } else if (authConfig.supabaseJwtSecret) {
            // Path 2: Legacy HS256 secret verification via jose
            const payload = await verifyJwtSecret(token, authConfig.supabaseJwtSecret);
            user = {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
                ...payload,
            };
        } else if (authConfig.supabaseUrl && authConfig.supabaseAnonKey) {
            // Path 3: Supabase Auth REST verification fallback
            user = await verifyWithSupabase(token);
        } else {
            console.error('[auth] Neither SUPABASE_JWT_SECRET, SUPABASE_JWKS_URL, nor SUPABASE_URL/ANON_KEY is configured.');
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
    verifyJwtWithJwks,
    verifyWithSupabase,
    hashToken,
    tokenCache,
    getAuthConfig,
};
