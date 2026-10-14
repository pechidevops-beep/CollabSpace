const test = require('node:test');
const assert = require('node:assert');
const { detectEntryPoint, SAFE_PY_FILENAME_RE } = require('../src/executor/pythonExecutor');

test('pythonExecutor: detects prioritized entry point filenames', () => {
    // main.py takes precedence
    assert.strictEqual(
        detectEntryPoint([{ path: 'helper.py' }, { path: 'main.py' }]),
        'main.py'
    );

    // app.py over run.py
    assert.strictEqual(
        detectEntryPoint([{ path: 'run.py' }, { path: 'app.py' }]),
        'app.py'
    );

    // nested src/main.py
    assert.strictEqual(
        detectEntryPoint([{ path: 'utils/math.py' }, { path: 'src/main.py' }]),
        'src/main.py'
    );

    // first .py file fallback
    assert.strictEqual(
        detectEntryPoint([{ path: 'custom_script.py' }]),
        'custom_script.py'
    );
});

test('pythonExecutor: rejects shell injection payloads in filenames', () => {
    // Semicolon injection
    assert.throws(
        () => detectEntryPoint([{ path: 'main;rm.py' }]),
        /Invalid Python filename/
    );

    // Pipe injection
    assert.throws(
        () => detectEntryPoint([{ path: 'main|cat.py' }]),
        /Invalid Python filename/
    );

    // Subshell evaluation injection
    assert.throws(
        () => detectEntryPoint([{ path: '$(whoami).py' }]),
        /Invalid Python filename/
    );

    // Backtick injection
    assert.throws(
        () => detectEntryPoint([{ path: 'main`id`.py' }]),
        /Invalid Python filename/
    );

    // Spaces in filename
    assert.throws(
        () => detectEntryPoint([{ path: 'my script.py' }]),
        /Invalid Python filename/
    );

    // Traversal in filename
    assert.throws(
        () => detectEntryPoint([{ path: '../escape.py' }]),
        /Invalid Python filename/
    );
});

test('pythonExecutor: throws when no .py files are present', () => {
    assert.throws(
        () => detectEntryPoint([{ path: 'readme.md' }, { path: 'data.json' }]),
        /No \.py file found/
    );
});
