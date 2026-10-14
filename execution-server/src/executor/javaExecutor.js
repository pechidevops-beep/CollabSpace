const fs = require('fs');
const path = require('path');
const { dockerRun, COMPILE_TIMEOUT_MS, RUN_TIMEOUT_MS } = require('../utils/docker');

const JAVA_IMAGE = process.env.JAVA_IMAGE || 'collabspace-java';

// Allowlist regex for fully-qualified Java class names
const JAVA_CLASS_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/;

/**
 * Detects the main class (containing public static void main) from Java source files.
 * Returns the fully-qualified class name (e.g., "com.project.Main").
 *
 * @param {string} tempDir - Root temp directory
 * @returns {string|null} - Fully qualified main class name or null
 */
function detectMainClass(tempDir) {
    const javaFiles = findJavaFiles(tempDir);

    for (const filePath of javaFiles) {
        let content;
        try {
            content = fs.readFileSync(filePath, 'utf8');
        } catch {
            continue;
        }

        // Check if this file contains the main method
        if (!/public\s+static\s+void\s+main\s*\(/.test(content)) continue;

        // Extract package declaration
        const packageMatch = content.match(/^\s*package\s+([\w.]+)\s*;/m);
        const pkg = packageMatch ? packageMatch[1] : null;

        // Extract class name
        const classMatch = content.match(/public\s+class\s+([A-Za-z0-9_$]+)/);
        if (!classMatch) continue;

        const className = classMatch[1];
        const fullClassName = pkg ? `${pkg}.${className}` : className;

        if (JAVA_CLASS_RE.test(fullClassName)) {
            return fullClassName;
        }
    }

    return null;
}

/**
 * Recursively find all .java files under tempDir
 */
function findJavaFiles(dir) {
    const results = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...findJavaFiles(fullPath));
            } else if (entry.name.endsWith('.java')) {
                results.push(fullPath);
            }
        }
    } catch { /* ignore */ }
    return results;
}

/**
 * Run a Java multi-file project inside Docker with separate compile and run steps.
 *
 * Step 1: Compile with javac (timeout: COMPILE_TIMEOUT_MS, default 15s)
 * Step 2: Execute detected main class (timeout: RUN_TIMEOUT_MS, default 10s)
 *
 * @param {string} tempDir - Absolute path to temp directory containing project files
 * @param {Object} [options]
 * @param {string} [options.stdin]
 * @param {string} [options.runId]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{stdout, stderr, exitCode, executionTime, status}>}
 */
async function run(tempDir, options = {}) {
    const { stdin, runId, signal } = options;
    const mainClass = detectMainClass(tempDir);

    if (!mainClass) {
        return {
            stdout: '',
            stderr: 'Could not find a main class.\n\nMake sure one of your .java files contains:\n  public static void main(String[] args)',
            exitCode: 1,
            executionTime: 0,
            status: 'compile_error',
        };
    }

    if (!JAVA_CLASS_RE.test(mainClass)) {
        return {
            stdout: '',
            stderr: `Invalid Java class name: "${mainClass}".`,
            exitCode: 1,
            executionTime: 0,
            status: 'compile_error',
        };
    }

    // Create a host outDir for compiled .class files
    const outDir = path.join(tempDir, '.collabspace_out');
    fs.mkdirSync(outDir, { recursive: true });
    const normalizedOutDir = outDir.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1');

    // ── STEP 1: Compile ────────────────────────────────────────────────────────
    const compileCmd = [
        'find /app -name "*.java" > /tmp/sources.txt',
        'javac -d /out @/tmp/sources.txt',
    ].join(' && ');

    const compileResult = await dockerRun(JAVA_IMAGE, tempDir, compileCmd, {
        timeoutMs: COMPILE_TIMEOUT_MS,
        runId: `${runId || 'run'}-compile`,
        signal,
        shell: true,
        isCompile: true,
        extraMounts: [`${normalizedOutDir}:/out:rw`],
    });

    if (compileResult.status === 'cancelled') {
        return compileResult;
    }

    if (compileResult.status === 'timeout') {
        return {
            ...compileResult,
            status: 'timeout',
            stderr: 'Compilation timed out.\n' + compileResult.stderr,
        };
    }

    if (compileResult.exitCode !== 0) {
        return {
            ...compileResult,
            status: 'compile_error',
        };
    }

    // ── STEP 2: Run ────────────────────────────────────────────────────────────
    const runCmd = `java -cp /out:/app ${mainClass}`;

    const execResult = await dockerRun(JAVA_IMAGE, tempDir, runCmd, {
        stdin,
        timeoutMs: RUN_TIMEOUT_MS,
        runId: `${runId || 'run'}-exec`,
        signal,
        shell: true,
        isCompile: false,
        extraMounts: [`${normalizedOutDir}:/out:ro`], // Read-only during execution
    });

    return {
        ...execResult,
        executionTime: compileResult.executionTime + execResult.executionTime,
    };
}

module.exports = { run, detectMainClass, JAVA_CLASS_RE };
