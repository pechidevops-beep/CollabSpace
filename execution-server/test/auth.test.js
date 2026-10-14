const test = require('node:test');
const assert = require('node:assert');
const { requireAuth, verifyJwtSecret } = require('../src/middleware/auth');
const { createTestToken, createMockReqRes } = require('./setup');

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

test('auth: accepts test-token in test environment', async () => {
    const { req, res } = createMockReqRes({
        headers: { authorization: 'Bearer test-token:bob-user-123' },
    });
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.userId, 'bob-user-123');
});

test('auth: rejects tampered or expired JWTs (401)', async () => {
    const validToken = createTestToken('user-uuid-abc');
    // Tamper with signature
    const tampered = validToken.slice(0, -5) + 'xxxxx';

    const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${tampered}` },
    });
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
});
