const test = require('node:test');
const assert = require('node:assert');
const app = require('../src/index');
const { createTestToken } = require('./setup');

// Helper to make mock requests to express app without listening on a port
function makeRequest(app, { method, url, headers = {}, body = null }) {
    return new Promise((resolve, reject) => {
        const http = require('http');
        const server = http.createServer(app);

        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            const req = http.request({
                hostname: '127.0.0.1',
                port,
                path: url,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
            }, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    server.close();
                    let parsed = null;
                    try { parsed = JSON.parse(data); } catch { parsed = data; }
                    resolve({ status: res.statusCode, headers: res.headers, body: parsed });
                });
            });

            req.on('error', (err) => {
                server.close();
                reject(err);
            });

            if (body) {
                req.write(typeof body === 'string' ? body : JSON.stringify(body));
            }
            req.end();
        });
    });
}

test('api: GET /health returns 200 with status ok and concurrency stats', async () => {
    const res = await makeRequest(app, { method: 'GET', url: '/health' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.ok(res.body.concurrency);
    assert.strictEqual(typeof res.body.concurrency.activeGlobalRuns, 'number');
});

test('api: POST /api/run returns 401 when no auth header is provided', async () => {
    const res = await makeRequest(app, {
        method: 'POST',
        url: '/api/run',
        body: { language: 'python', files: [{ path: 'main.py', content: 'print(1)' }] },
    });
    assert.strictEqual(res.status, 401);
    assert.ok(res.body.error.includes('Missing Authorization'));
});

test('api: POST /api/run returns 400 when body is missing language or files', async () => {
    const token = createTestToken('api-user-test');
    const res = await makeRequest(app, {
        method: 'POST',
        url: '/api/run',
        headers: { Authorization: `Bearer ${token}` },
        body: {},
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('language and files are required'));
});

test('api: POST /api/run returns 400 for unsupported language', async () => {
    const token = createTestToken('api-user-test');
    const res = await makeRequest(app, {
        method: 'POST',
        url: '/api/run',
        headers: { Authorization: `Bearer ${token}` },
        body: { language: 'ruby', files: [{ path: 'main.rb', content: 'puts 1' }] },
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('Unsupported language'));
});

test('api: CORS policy blocks unauthorized origins with 403', async () => {
    const res = await makeRequest(app, {
        method: 'GET',
        url: '/health',
        headers: { Origin: 'http://malicious-site.example.com' },
    });
    // CORS middleware responds with 403 when origin is disallowed
    assert.strictEqual(res.status, 403);
    assert.ok(res.body.error.includes('CORS'));
});
