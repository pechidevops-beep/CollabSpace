const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.ALLOW_TEST_AUTH = 'true';
process.env.SUPABASE_JWT_SECRET = 'test-secret-collabspace-hardening-key';
process.env.RATE_LIMIT_MAX = '10';
process.env.MAX_CONCURRENT_RUNS = '3';
process.env.MAX_USER_CONCURRENCY = '1';

/**
 * Creates a valid test JWT signed with SUPABASE_JWT_SECRET
 */
function createTestToken(sub = 'test-user-uuid', email = 'test@collabspace.dev') {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        sub,
        email,
        role: 'authenticated',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');

    const sig = crypto
        .createHmac('sha256', process.env.SUPABASE_JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');

    return `${header}.${payload}.${sig}`;
}

/**
 * Creates a mock express req and res object
 */
function createMockReqRes({ method = 'GET', url = '/', headers = {}, body = {} } = {}) {
    const req = {
        method,
        url,
        path: url.split('?')[0],
        headers: { ...headers },
        body: { ...body },
        ip: '127.0.0.1',
        user: null,
        userId: null,
    };

    const res = {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        },
        send(data) {
            this.body = data;
            return this;
        },
        setHeader(key, val) {
            this.headers[key.toLowerCase()] = val;
        },
        getHeader(key) {
            return this.headers[key.toLowerCase()];
        },
        on(event, handler) {
            // Mock event listener
            return this;
        },
    };

    return { req, res };
}

module.exports = {
    createTestToken,
    createMockReqRes,
};
