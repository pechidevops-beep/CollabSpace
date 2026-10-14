const fs = require('fs');
const path = require('path');
const { dockerRun } = require('../utils/docker');

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
 * Run a Java multi-file project inside Docker with hardened read-only sandbox.
 * Compiles with javac into /tmp/out (size-limited tmpfs) and runs the detected main class.
 *
 * @param {string} tempDir - Absolute path to temp directory containing project files
 * @param {Object} [options]
 * @returns {Promise<{stdout, stderr, exitCode, executionTime}>}
 */
async function run(tempDir, options = {}) {
    const { stdin, runId } = options;
    const mainClass = detectMainClass(tempDir);

    if (!mainClass) {
        return {
            stdout: '',
            stderr: 'Could not find a main class.\n\nMake sure one of your .java files contains:\n  public static void main(String[] args)',
            exitCode: 1,
            executionTime: 0,
        };
    }

    if (!JAVA_CLASS_RE.test(mainClass)) {
        return {
            stdout: '',
            stderr: `Invalid Java class name: "${mainClass}".`,
            exitCode: 1,
            executionTime: 0,
        };
    }

    console.log(`[Java] Detected main class: ${mainClass}`);

    // Build command:
    // 1. Make /tmp/out inside writable tmpfs (root and /app are --read-only)
    // 2. Find all .java files under /app
    // 3. Compile them into /tmp/out
    // 4. Run main class with classpath pointing to /tmp/out and /app
    const command = [
        'mkdir -p /tmp/out',
        'find /app -name "*.java" > /tmp/sources.txt',
        'javac -d /tmp/out @/tmp/sources.txt 2>&1 || exit 1',
        `java -cp /tmp/out:/app ${mainClass}`,
    ].join(' && ');

    return await dockerRun(JAVA_IMAGE, tempDir, command, {
        stdin,
        runId,
        shell: true,
    });
}

module.exports = { run, detectMainClass, JAVA_CLASS_RE };
