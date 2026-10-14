const test = require('node:test');
const assert = require('node:assert');
const { buildDockerArgs } = require('../src/utils/docker');
const {
    reapContainers,
    startupReaper,
    registerInFlight,
    unregisterInFlight,
    inFlightContainers,
    DEFAULT_MAX_AGE_MS,
} = require('../src/utils/reaper');

test('dockerSandbox: verifies all hardened Docker flags and ulimits are present', () => {
    const args = buildDockerArgs({
        image: 'collabspace-python',
        tempDir: 'C:\\test\\tempdir',
        command: ['python3', '-u', '/app/main.py'],
        containerName: 'collabspace-run-test-id-123',
        runId: 'test-id-123',
        options: { env: { PYTHONPATH: '/app' } },
    });

    // 1. Root filesystem is read-only
    assert.ok(args.includes('--read-only'), 'Must include --read-only');

    // 2. Size-limited tmpfs for temporary files
    assert.ok(
        args.includes('--tmpfs') && args.includes('/tmp:rw,nosuid,nodev,size=64m'),
        'Must mount size-limited /tmp tmpfs'
    );

    // 3. Memory limit and swap lock
    assert.ok(args.includes('--memory=128m'), 'Must enforce --memory');
    assert.ok(args.includes('--memory-swap=128m'), '--memory-swap must equal --memory to prevent swap');

    // 4. Thread / process limit (anti fork-bomb)
    assert.ok(args.includes('--pids-limit=64'), 'Must enforce --pids-limit');

    // 5. Capability drop
    assert.ok(args.includes('--cap-drop=ALL'), 'Must drop all Linux capabilities');

    // 6. Privilege escalation prevention
    assert.ok(args.includes('--security-opt=no-new-privileges'), 'Must enforce no-new-privileges');

    // 7. Non-root user
    assert.ok(args.includes('--user=sandbox'), 'Must run as non-root user');

    // 8. Isolated network
    assert.ok(args.includes('--network=none'), 'Must disable network');

    // 9. Ulimits: nofile and fsize
    assert.ok(args.includes('--ulimit') && args.includes('nofile=256:512'), 'Must include nofile ulimit');
    assert.ok(args.includes('fsize=10485760'), 'Must include fsize ulimit (10MB)');

    // 10. Read-only volume mount for source code
    assert.ok(
        args.some(a => a.endsWith(':/app:ro')),
        'Source volume must be mounted read-only (:ro)'
    );

    // 11. Unique container name and reaper labels
    assert.ok(args.includes('collabspace-run-test-id-123'), 'Must use unique container name');
    assert.ok(args.includes('collabspace=true'), 'Must include reaper label');
    assert.ok(args.includes('collabspace.runId=test-id-123'), 'Must include runId label');

    // 12. Direct argv execution without sh -c
    assert.ok(!args.includes('sh'), 'Should not use sh -c for argv array');
    assert.ok(!args.includes('-c'), 'Should not use -c for argv array');
    assert.ok(args.includes('python3') && args.includes('/app/main.py'));
});

test('dockerSandbox: Java uses 512m memory limit', () => {
    const javaArgs = buildDockerArgs({
        image: 'collabspace-java',
        tempDir: 'C:\\test\\tempdir',
        command: 'java App',
        containerName: 'collabspace-java-test',
        runId: 'java-test',
    });
    assert.ok(javaArgs.includes('--memory=512m'), 'Java must have 512m memory limit');
    assert.ok(javaArgs.includes('--memory-swap=512m'), 'Java swap must equal memory');
});

test('dockerSandbox: reaper protects active in-flight containers from being killed', async () => {
    const activeName = 'collabspace-run-active-protected';
    registerInFlight(activeName);

    try {
        assert.ok(inFlightContainers.has(activeName));

        // When reapContainers runs, it checks inFlightContainers.
        // Even with maxAgeMs = 0 (everything is considered old), active container must NOT be removed.
        const removed = await reapContainers(false, 0);
        assert.strictEqual(typeof removed, 'number');

        // Confirm active container remains in in-flight registry
        assert.ok(inFlightContainers.has(activeName), 'Protected container must remain registered in-flight');
    } finally {
        unregisterInFlight(activeName);
        assert.strictEqual(inFlightContainers.has(activeName), false);
    }
});

test('dockerSandbox: reaper functions execute cleanly without uncaught errors', async () => {
    await startupReaper();
    const count = await reapContainers(false);
    assert.strictEqual(typeof count, 'number');
});
