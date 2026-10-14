const test = require('node:test');
const assert = require('node:assert');
const { rateLimiter, resetRateLimiter, RATE_LIMIT_MAX } = require('../src/middleware/rateLimiter');
const {
    acquireSlot,
    resetConcurrency,
    MAX_CONCURRENT_RUNS,
    MAX_USER_CONCURRENCY,
} = require('../src/middleware/concurrency');
const { createMockReqRes } = require('./setup');

test('rateLimiter: enforces per-user rate limit and sets Retry-After on 429', () => {
    resetRateLimiter();
    const userId = 'user-ratelimit-suite';

    // First RATE_LIMIT_MAX requests should succeed
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        const { req, res } = createMockReqRes();
        req.userId = userId;
        let called = false;
        rateLimiter(req, res, () => { called = true; });
        assert.strictEqual(called, true, `Request ${i + 1} should be allowed`);
    }

    // Subsequent request must be blocked with 429
    const { req, res } = createMockReqRes();
    req.userId = userId;
    let blockedCalled = false;
    rateLimiter(req, res, () => { blockedCalled = true; });

    assert.strictEqual(blockedCalled, false);
    assert.strictEqual(res.statusCode, 429);
    assert.ok(res.headers['retry-after'] >= 1, 'Retry-After header must be present');
    assert.strictEqual(res.headers['x-ratelimit-remaining'], 0);
});

test('concurrency: blocks parallel requests from the same user (429)', async () => {
    resetConcurrency();
    const userId = 'user-concurrent-1';

    const release1 = await acquireSlot(userId);
    assert.strictEqual(typeof release1, 'function');

    // Second slot request from same user should reject with 429
    await assert.rejects(
        () => acquireSlot(userId),
        (err) => err.statusCode === 429 && err.message.includes('Per-user concurrency')
    );

    // Release slot 1
    release1();

    // Now acquiring should succeed again
    const release2 = await acquireSlot(userId);
    release2();
});

test('concurrency: queues requests when global limit is reached and drains on release', async () => {
    resetConcurrency();
    const releases = [];

    // Fill up to MAX_CONCURRENT_RUNS with different users
    for (let i = 0; i < MAX_CONCURRENT_RUNS; i++) {
        releases.push(await acquireSlot(`user-pool-${i}`));
    }

    // Request from a new user should be queued
    let resolved = false;
    const queuedPromise = acquireSlot('user-pool-queued').then((r) => {
        resolved = true;
        return r;
    });

    // Brief delay to confirm it remains unresolved in queue
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(resolved, false, 'Queued request should wait for free slot');

    // Release first slot
    releases[0]();

    // Queued request should now resolve
    const queuedRelease = await queuedPromise;
    assert.strictEqual(resolved, true);

    // Clean up
    queuedRelease();
    for (let i = 1; i < releases.length; i++) releases[i]();
});
