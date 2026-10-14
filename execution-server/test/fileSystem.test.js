const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { v4: uuidv4 } = require('uuid');

const {
    createTempDir,
    writeFiles,
    cleanup,
    safePath,
    getJavaCanonicalPath,
    stripCommentsAndStrings,
    MAX_FILES,
    MAX_SINGLE_FILE_BYTES,
    MAX_TOTAL_BYTES,
} = require('../src/utils/fileSystem');

test('fileSystem: safePath resolves safe relative paths inside baseDir', () => {
    const base = os.tmpdir();
    const resolved = safePath(base, 'src/main.py');
    assert.strictEqual(resolved, path.resolve(base, 'src/main.py'));
});

test('fileSystem: safePath rejects directory traversal segments (..)', () => {
    const base = os.tmpdir();
    assert.throws(() => safePath(base, '../outside.py'), /Path traversal/);
    assert.throws(() => safePath(base, 'foo/../../bar.py'), /Path traversal/);
    assert.throws(() => safePath(base, '..'), /Path traversal/);
});

test('fileSystem: safePath rejects leading slashes', () => {
    const base = os.tmpdir();
    assert.throws(() => safePath(base, '/etc/passwd'), /Leading slash/);
    assert.throws(() => safePath(base, '\\Windows\\System32'), /Leading slash/);
});

test('fileSystem: safePath rejects null bytes', () => {
    const base = os.tmpdir();
    assert.throws(() => safePath(base, 'app.py\0.txt'), /Null byte/);
});

test('fileSystem: safePath rejects absolute Windows drive letters and UNC paths', () => {
    const base = os.tmpdir();
    assert.throws(() => safePath(base, 'C:\\boot.ini'), /Absolute path/);
    assert.throws(() => safePath(base, '//server/share/file.py'), /Absolute path/);
});

test('fileSystem: safePath rejects hidden files/folders', () => {
    const base = os.tmpdir();
    assert.throws(() => safePath(base, '.env'), /Hidden file/);
    assert.throws(() => safePath(base, '.git/config'), /Hidden file/);
});

test('fileSystem: safePath rejects forbidden characters', () => {
    const base = os.tmpdir();
    assert.throws(() => safePath(base, 'main;rm.py'), /Invalid characters/);
    assert.throws(() => safePath(base, 'main|cat.py'), /Invalid characters/);
    assert.throws(() => safePath(base, 'file name.py'), /Invalid characters/);
});

test('fileSystem: writeFiles enforces file limits and cleans up correctly', async () => {
    const runId = uuidv4();
    const tempDir = await createTempDir(runId);

    try {
        // Enforce MAX_FILES
        const tooManyFiles = Array.from({ length: MAX_FILES + 1 }, (_, i) => ({
            path: `file${i}.py`,
            content: 'x = 1',
        }));
        await assert.rejects(
            () => writeFiles(tempDir, tooManyFiles),
            /Too many files/
        );

        // Enforce MAX_SINGLE_FILE_BYTES
        const oversizedFile = [{
            path: 'big.py',
            content: 'a'.repeat(MAX_SINGLE_FILE_BYTES + 10),
        }];
        await assert.rejects(
            () => writeFiles(tempDir, oversizedFile),
            /max 524288/
        );

        // Valid write creates files and subdirectories
        const validFiles = [
            { path: 'main.py', content: 'print("hello")' },
            { path: 'pkg/sub/helper.py', content: 'def f(): return 42' },
        ];
        await writeFiles(tempDir, validFiles);

        assert.strictEqual(
            fs.readFileSync(path.join(tempDir, 'main.py'), 'utf8'),
            'print("hello")'
        );
        assert.strictEqual(
            fs.readFileSync(path.join(tempDir, 'pkg', 'sub', 'helper.py'), 'utf8'),
            'def f(): return 42'
        );

        // Java canonicalization: jav.java with "public class HelloWorld" is written as HelloWorld.java
        const javaFiles = [
            {
                path: 'jav.java',
                content: 'public class HelloWorld { public static void main(String[] args) {} }',
            },
        ];
        await writeFiles(tempDir, javaFiles);
        assert.ok(fs.existsSync(path.join(tempDir, 'HelloWorld.java')), 'HelloWorld.java must exist on disk');
        assert.strictEqual(fs.existsSync(path.join(tempDir, 'jav.java')), false, 'jav.java is mapped to HelloWorld.java so javac sees only ClassName.java');
    } finally {
        await cleanup(tempDir);
        assert.strictEqual(fs.existsSync(tempDir), false);
    }
});

test('fileSystem: getJavaCanonicalPath handles modifiers (final, abstract, sealed, strictfp, non-sealed)', () => {
    assert.strictEqual(
        getJavaCanonicalPath('foo.java', 'public final class FinalService {}'),
        'FinalService.java'
    );
    assert.strictEqual(
        getJavaCanonicalPath('foo.java', 'public abstract class AbstractBase {}'),
        'AbstractBase.java'
    );
    assert.strictEqual(
        getJavaCanonicalPath('foo.java', 'public sealed class SealedShape permits Circle {}'),
        'SealedShape.java'
    );
    assert.strictEqual(
        getJavaCanonicalPath('foo.java', 'public non-sealed class Circle extends SealedShape {}'),
        'Circle.java'
    );
    assert.strictEqual(
        getJavaCanonicalPath('foo.java', 'public strictfp class MathUtil {}'),
        'MathUtil.java'
    );
    assert.strictEqual(
        getJavaCanonicalPath('foo.java', 'final public class ReversedOrder {}'),
        'ReversedOrder.java'
    );
});

test('fileSystem: getJavaCanonicalPath handles interface, enum, and record', () => {
    assert.strictEqual(
        getJavaCanonicalPath('foo.java', 'public interface Printable { void print(); }'),
        'Printable.java'
    );
    assert.strictEqual(
        getJavaCanonicalPath('foo.java', 'public enum Direction { NORTH, SOUTH; }'),
        'Direction.java'
    );
    assert.strictEqual(
        getJavaCanonicalPath('foo.java', 'public record UserRecord(String id, String name) {}'),
        'UserRecord.java'
    );
});

test('fileSystem: getJavaCanonicalPath strips comments and string literals to prevent false matches', () => {
    // 1. Comments containing false public class declarations should be ignored
    const commentedCode = `
        // public class FakeCommentedClass {
        /*
           public class BlockCommentedClass {
        */
        public class RealClass {
            public static void main(String[] args) {}
        }
    `;
    assert.strictEqual(getJavaCanonicalPath('temp.java', commentedCode), 'RealClass.java');

    // 2. String literals containing false declarations should be ignored
    const stringLiteralCode = `
        public class StringContainer {
            String fake = "public class FakeInString {}";
            String block = """
                public class FakeInTextBlock {}
            """;
        }
    `;
    assert.strictEqual(getJavaCanonicalPath('temp.java', stringLiteralCode), 'StringContainer.java');
});

test('fileSystem: writeFiles rejects collision when target canonical name already exists', async () => {
    const runId = uuidv4();
    const tempDir = await createTempDir(runId);
    try {
        const conflictingFiles = [
            {
                path: 'HelloWorld.java',
                content: 'public class HelloWorld { public static void main(String[] args) {} }',
            },
            {
                path: 'another.java',
                content: 'public class HelloWorld { /* duplicate class name */ }',
            },
        ];

        await assert.rejects(
            () => writeFiles(tempDir, conflictingFiles),
            /Canonical Java filename collision/
        );
    } finally {
        await cleanup(tempDir);
    }
});
