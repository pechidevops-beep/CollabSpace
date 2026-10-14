const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const { createTempDir, writeFiles, cleanup } = require('../../src/utils/fileSystem');
const javaExecutor = require('../../src/executor/javaExecutor');
const pythonExecutor = require('../../src/executor/pythonExecutor');
const { dockerRun } = require('../../src/utils/docker');

function checkDocker() {
    try {
        const res = spawnSync('docker', ['info'], { encoding: 'utf8', timeout: 4000 });
        return res.status === 0;
    } catch {
        return false;
    }
}

const DOCKER_AVAILABLE = checkDocker();

if (!DOCKER_AVAILABLE) {
    console.log('\n[NOTICE] Docker engine is not accessible on this system. Skipping integration tests.\n');
}

test('integration: jav.java Hello World and Python Hello World succeed (exit 0)', { skip: !DOCKER_AVAILABLE }, async () => {
    // 1. Java with jav.java containing public class HelloWorld
    const javaRunId = uuidv4();
    const javaTemp = await createTempDir(javaRunId);
    try {
        const files = [{
            path: 'jav.java',
            content: `
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello Java from jav.java");
    }
}
`,
        }];
        await writeFiles(javaTemp, files);
        const result = await javaExecutor.run(javaTemp, { runId: javaRunId });
        assert.strictEqual(result.exitCode, 0, `Java failed: ${result.stderr}`);
        assert.strictEqual(result.status, 'ok');
        assert.ok(result.stdout.includes('Hello Java from jav.java'));
    } finally {
        await cleanup(javaTemp);
    }

    // 2. Python Hello World
    const pyRunId = uuidv4();
    const pyTemp = await createTempDir(pyRunId);
    try {
        const files = [{
            path: 'main.py',
            content: 'print("Hello Python World")',
        }];
        await writeFiles(pyTemp, files);
        const result = await pythonExecutor.run(pyTemp, files, { runId: pyRunId });
        assert.strictEqual(result.exitCode, 0, `Python failed: ${result.stderr}`);
        assert.strictEqual(result.status, 'ok');
        assert.ok(result.stdout.includes('Hello Python World'));
    } finally {
        await cleanup(pyTemp);
    }
});

test('integration: Python infinite loop -> timeout, container gone', { skip: !DOCKER_AVAILABLE }, async () => {
    const runId = uuidv4();
    const tempDir = await createTempDir(runId);
    try {
        const files = [{
            path: 'main.py',
            content: 'import time\nwhile True:\n    time.sleep(0.1)\n',
        }];
        await writeFiles(tempDir, files);

        const result = await pythonExecutor.run(tempDir, files, { runId, timeoutMs: 2000 });

        assert.strictEqual(result.status, 'timeout');
        assert.strictEqual(result.exitCode, 124);

        // Brief pause for Docker Desktop daemon state sync
        await new Promise(r => setTimeout(r, 300));
        const psCheck = spawnSync('docker', ['ps', '-a', '--filter', `name=collabspace-run-${runId}`, '-q'], { encoding: 'utf8' });
        assert.strictEqual(psCheck.stdout.trim(), '', 'Container must be completely removed');
    } finally {
        await cleanup(tempDir);
    }
});

test('integration: bounded process spawn (try 200 processes) -> blocked near pids-limit', { skip: !DOCKER_AVAILABLE }, async () => {
    const runId = uuidv4();
    const tempDir = await createTempDir(runId);
    try {
        const files = [{
            path: 'main.py',
            content: `
import os, time
count = 0
for i in range(200):
    try:
        pid = os.fork()
        if pid == 0:
            time.sleep(2)
            os._exit(0)
        count += 1
    except (BlockingIOError, OSError) as e:
        print(f"BLOCKED_AT:{count}")
        break
print(f"TOTAL_SPAWNED:{count}")
`,
        }];
        await writeFiles(tempDir, files);
        const result = await pythonExecutor.run(tempDir, files, { runId });

        // Must be blocked near the 64 pids-limit
        assert.ok(result.stdout.includes('BLOCKED_AT:'), `Should hit fork limit: ${result.stdout}`);
        const match = result.stdout.match(/TOTAL_SPAWNED:(\d+)/);
        assert.ok(match, 'Output must include TOTAL_SPAWNED');
        const spawned = parseInt(match[1], 10);
        assert.ok(spawned < 100, `Spawn count ${spawned} must be capped by pids-limit (64)`);
    } finally {
        await cleanup(tempDir);
    }
});

test('integration: bounded memory allocation (up to 512 MB) -> killed at limit', { skip: !DOCKER_AVAILABLE }, async () => {
    const runId = uuidv4();
    const tempDir = await createTempDir(runId);
    try {
        // Python limit is 128 MB; try to allocate 512 MB
        const files = [{
            path: 'main.py',
            content: `
chunks = []
for i in range(512):
    chunks.append(bytearray(1024 * 1024)) # 1MB each
print("ALLOCATED_ALL")
`,
        }];
        await writeFiles(tempDir, files);
        const result = await pythonExecutor.run(tempDir, files, { runId });

        // Must be oom_killed (exit code 137)
        assert.strictEqual(result.status, 'oom_killed', `Expected oom_killed, got: ${result.status} (exit ${result.exitCode})`);
        assert.strictEqual(result.exitCode, 137);
        assert.ok(!result.stdout.includes('ALLOCATED_ALL'), 'Should not complete allocation');
    } finally {
        await cleanup(tempDir);
    }
});

test('integration: bounded output (50 MB) -> truncated and killed at hard cap', { skip: !DOCKER_AVAILABLE }, async () => {
    const runId = uuidv4();
    const tempDir = await createTempDir(runId);
    try {
        const files = [{
            path: 'main.py',
            content: `
chunk = "X" * (1024 * 100) # 100KB
for _ in range(500): # 50 MB total
    print(chunk)
`,
        }];
        await writeFiles(tempDir, files);
        const result = await pythonExecutor.run(tempDir, files, { runId });

        // Total received bytes must be bounded
        const totalLen = (result.stdout + result.stderr).length;
        assert.ok(totalLen <= 1024 * 1024 + 10000, `Output length ${totalLen} must not exceed ~1MB hard cap`);
        assert.ok(
            result.stdout.includes('Output truncated') || result.stderr.includes('exceeded maximum output limit'),
            'Must contain truncation or limit notice'
        );
    } finally {
        await cleanup(tempDir);
    }
});

test('integration: network attempt (connect to 1.1.1.1:53) -> fails due to --network=none', { skip: !DOCKER_AVAILABLE }, async () => {
    const runId = uuidv4();
    const tempDir = await createTempDir(runId);
    try {
        const files = [{
            path: 'main.py',
            content: `
import socket
try:
    s = socket.create_connection(("1.1.1.1", 53), timeout=1)
    print("NET_SUCCESS")
except Exception as e:
    print(f"NET_FAILED:{type(e).__name__}")
`,
        }];
        await writeFiles(tempDir, files);
        const result = await pythonExecutor.run(tempDir, files, { runId });

        assert.strictEqual(result.exitCode, 0);
        assert.ok(result.stdout.includes('NET_FAILED:'), `Network must fail: ${result.stdout}`);
        assert.ok(!result.stdout.includes('NET_SUCCESS'));
    } finally {
        await cleanup(tempDir);
    }
});

test('integration: writes to /app and / fail; /tmp beyond 64 MB fails', { skip: !DOCKER_AVAILABLE }, async () => {
    const runId = uuidv4();
    const tempDir = await createTempDir(runId);
    try {
        const files = [{
            path: 'main.py',
            content: `
app_write = False
try:
    with open("/app/test.txt", "w") as f:
        f.write("fail")
    app_write = True
except OSError:
    pass

root_write = False
try:
    with open("/root_test.txt", "w") as f:
        f.write("fail")
    root_write = True
except OSError:
    pass

tmp_overflow = False
try:
    with open("/tmp/big.dat", "wb") as f:
        for _ in range(70): # 70 MB in 64MB tmpfs
            f.write(b"x" * (1024 * 1024))
    tmp_overflow = True
except OSError:
    # Expected: No space left on device
    pass

print(f"APP:{app_write},ROOT:{root_write},TMPOVERFLOW:{tmp_overflow}")
`,
        }];
        await writeFiles(tempDir, files);
        const result = await pythonExecutor.run(tempDir, files, { runId });

        assert.strictEqual(result.exitCode, 0);
        const outLower = result.stdout.toLowerCase();
        assert.ok(outLower.includes('app:false'), '/app write must fail');
        assert.ok(outLower.includes('root:false'), '/ write must fail');
        assert.ok(outLower.includes('tmpoverflow:false'), '/tmp beyond 64MB must fail');
    } finally {
        await cleanup(tempDir);
    }
});

test('integration: cancel mid-run -> container removed', { skip: !DOCKER_AVAILABLE }, async () => {
    const runId = uuidv4();
    const tempDir = await createTempDir(runId);
    try {
        const files = [{
            path: 'main.py',
            content: 'import time\ntime.sleep(10)\n',
        }];
        await writeFiles(tempDir, files);

        const abortController = new AbortController();

        // Trigger abort after 800ms to cancel mid-run
        setTimeout(() => {
            abortController.abort();
        }, 800);

        const result = await pythonExecutor.run(tempDir, files, {
            runId,
            signal: abortController.signal,
        });

        assert.strictEqual(result.status, 'cancelled');

        // Brief pause for Docker Desktop daemon state sync
        await new Promise(r => setTimeout(r, 400));
        const psCheck = spawnSync('docker', ['ps', '-a', '--filter', `name=collabspace-run-${runId}`, '-q'], { encoding: 'utf8' });
        assert.strictEqual(psCheck.stdout.trim(), '', 'Cancelled container must be removed');
    } finally {
        await cleanup(tempDir);
    }
});

test('integration: afterwards, docker ps -a --filter label=collabspace is empty', { skip: !DOCKER_AVAILABLE }, async () => {
    // Wait brief moment for any background removals to finish
    await new Promise(r => setTimeout(r, 500));
    const check = spawnSync('docker', ['ps', '-a', '--filter', 'label=collabspace=true', '-q'], { encoding: 'utf8' });
    assert.strictEqual(check.stdout.trim(), '', `No leftover collabspace containers should exist, got: ${check.stdout.trim()}`);
});
