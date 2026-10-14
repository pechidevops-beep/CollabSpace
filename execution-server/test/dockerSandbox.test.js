const test = require('node:test');
const assert = require('node:assert');
const { buildDockerArgs } = require('../src/utils/docker');
const { reapContainers, startupReaper } = require('../src/utils/reaper');

test('dockerSandbox: verifies all hardened Docker flags are present', () => {
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

    // 9. Read-only volume mount for source code
    assert.ok(
        args.some(a => a.endsWith(':/app:ro')),
        'Source volume must be mounted read-only (:ro)'
    );

    // 10. Unique container name and reaper labels
    assert.ok(args.includes('collabspace-run-test-id-123'), 'Must use unique container name');
    assert.ok(args.includes('collabspace=true'), 'Must include reaper label');
    assert.ok(args.includes('collabspace.runId=test-id-123'), 'Must include runId label');

    // 11. Direct argv execution without sh -c
    assert.ok(!args.includes('sh'), 'Should not use sh -c for argv array');
    assert.ok(!args.includes('-c'), 'Should not use -c for argv array');
    assert.ok(args.includes('python3') && args.includes('/app/main.py'));
});

test('dockerSandbox: reaper functions execute cleanly without uncaught errors', async () => {
    // When docker daemon is inactive, reaper should fail gracefully without throwing
    await startupReaper();
    const count = await reapContainers(false);
    assert.strictEqual(typeof count, 'number');
});
