const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { requireAuth, verifyJwtSecret, hashToken, tokenCache } = require('../src/middleware/auth');
const { validateServerEnvironment } = require('../src/index');
const { createTestToken, createMockReqRes } = require('./setup');

const TEST_SECRET = process.env.SUPABASE_JWT_SECRET || 'test-secret-collabspace-hardening-key';

test('auth: rejects requests with missing Authorization header (401)', async () => {
    const { req, res } = createMockReqRes();
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.ok(res.body.error.includes('Missing Authorization'));
});

test('auth: rejects requests with invalid Authorization format (401)', async () => {
    const { req, res } = createMockReqRes({
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.ok(res.body.error.includes('Bearer'));
});

test('auth: validates valid JWT and populates req.user and req.userId', async () => {
    const token = createTestToken('user-uuid-abc', 'alice@test.local');
    const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
    });
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.userId, 'user-uuid-abc');
    assert.strictEqual(req.user.email, 'alice@test.local');
});

test('auth: accepts test-token strictly when NODE_ENV === "test"', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_TEST_AUTH = 'true';

    const { req, res } = createMockReqRes({
        headers: { authorization: 'Bearer test-token:bob-user-123' },
    });
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.userId, 'bob-user-123');
});

test('auth: refuses to start if NODE_ENV === "production" and ALLOW_TEST_AUTH is set', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevAllow = process.env.ALLOW_TEST_AUTH;

    try {
        process.env.NODE_ENV = 'production';
        process.env.ALLOW_TEST_AUTH = 'true';

        assert.throws(
            () => validateServerEnvironment(),
            /Refusing to start in production with ALLOW_TEST_AUTH enabled/
        );
    } finally {
        process.env.NODE_ENV = prevEnv;
        process.env.ALLOW_TEST_AUTH = prevAllow;
    }
});

test('auth: rejects test-token when NODE_ENV === "production"', async () => {
    const prevEnv = process.env.NODE_ENV;
    try {
        process.env.NODE_ENV = 'production';

        const { req, res } = createMockReqRes({
            headers: { authorization: 'Bearer test-token:evil-actor' },
        });
        let nextCalled = false;

        await requireAuth(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res.statusCode, 401);
    } finally {
        process.env.NODE_ENV = prevEnv;
    }
});

test('auth: rejects JWT with alg: "none" or lowercase "none"', () => {
    // Construct unencoded/none JWT: header={"alg":"none"}, payload={...}, sig=""
    const h1 = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const p1 = Buffer.from(JSON.stringify({ sub: '123', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 1000 })).toString('base64url');
    const tokenNone1 = `${h1}.${p1}.`;

    assert.throws(
        () => verifyJwtSecret(tokenNone1, TEST_SECRET),
        /algorithm "none" is strictly forbidden/
    );

    const h2 = Buffer.from(JSON.stringify({ alg: 'NONE', typ: 'JWT' })).toString('base64url');
    const tokenNone2 = `${h2}.${p1}.`;
    assert.throws(
        () => verifyJwtSecret(tokenNone2, TEST_SECRET),
        /algorithm "none" is strictly forbidden/
    );
});

test('auth: rejects JWT with wrong audience', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        sub: 'user-123',
        aud: 'attacker-service',
        exp: Math.floor(Date.now() / 1000) + 1000,
    })).toString('base64url');

    const sig = crypto.createHmac('sha256', TEST_SECRET).update(`${header}.${payload}`).digest('base64url');
    const token = `${header}.${payload}.${sig}`;

    assert.throws(
        () => verifyJwtSecret(token, TEST_SECRET),
        /Invalid JWT audience/
    );
});

test('auth: rejects JWT with wrong signature', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        sub: 'user-123',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 1000,
    })).toString('base64url');

    // Signed with wrong secret
    const sig = crypto.createHmac('sha256', 'wrong-key-5678').update(`${header}.${payload}`).digest('base64url');
    const token = `${header}.${payload}.${sig}`;

    assert.throws(
        () => verifyJwtSecret(token, TEST_SECRET),
        /Invalid JWT signature/
    );
});

test('auth: cache keys are SHA-256 hashes of tokens, never raw tokens', async () => {
    const token = createTestToken('cache-key-user', 'cached@test.local');
    const expectedHash = hashToken(token);

    const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
    });
    await requireAuth(req, res, () => {});

    // Token cache MUST store the SHA-256 hash as key, not the raw token
    assert.strictEqual(tokenCache.has(token), false, 'Raw token must NOT be in cache keys');
    assert.strictEqual(tokenCache.has(expectedHash), true, 'SHA-256 hash of token must be in cache keys');
});
