const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { v4: uuidv4 } = require('uuid');

const { detectMainClass, JAVA_CLASS_RE } = require('../src/executor/javaExecutor');

test('javaExecutor: detects main class without package', () => {
    const tmp = path.join(os.tmpdir(), `collabspace-java-test-${uuidv4()}`);
    fs.mkdirSync(tmp, { recursive: true });

    try {
        fs.writeFileSync(
            path.join(tmp, 'App.java'),
            'public class App { public static void main(String[] args) {} }'
        );
        const mainClass = detectMainClass(tmp);
        assert.strictEqual(mainClass, 'App');
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('javaExecutor: detects main class with package statement', () => {
    const tmp = path.join(os.tmpdir(), `collabspace-java-test-${uuidv4()}`);
    fs.mkdirSync(tmp, { recursive: true });

    try {
        fs.writeFileSync(
            path.join(tmp, 'Solution.java'),
            'package com.collab.exercise;\npublic class Solution { public static void main(String[] args) {} }'
        );
        const mainClass = detectMainClass(tmp);
        assert.strictEqual(mainClass, 'com.collab.exercise.Solution');
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('javaExecutor: class name allowlist blocks malicious names', () => {
    assert.strictEqual(JAVA_CLASS_RE.test('Main'), true);
    assert.strictEqual(JAVA_CLASS_RE.test('com.example.Runner_1'), true);

    // Shell metacharacters rejected
    assert.strictEqual(JAVA_CLASS_RE.test('Main; rm -rf /'), false);
    assert.strictEqual(JAVA_CLASS_RE.test('Main$(whoami)'), false);
    assert.strictEqual(JAVA_CLASS_RE.test('Main|cat'), false);
    assert.strictEqual(JAVA_CLASS_RE.test('Main`id`'), false);
});
