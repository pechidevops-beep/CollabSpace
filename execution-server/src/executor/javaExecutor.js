const fs = require('fs');
const path = require('path');
const { dockerRun } = require('../utils/docker');

const JAVA_IMAGE = process.env.JAVA_IMAGE || 'collabspace-java';

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
        const content = fs.readFileSync(filePath, 'utf8');

        // Check if this file contains the main method
        if (!/public\s+static\s+void\s+main\s*\(/.test(content)) continue;

        // Extract package declaration
        const packageMatch = content.match(/^\s*package\s+([\w.]+)\s*;/m);
        const pkg = packageMatch ? packageMatch[1] : null;

        // Extract class name
        const classMatch = content.match(/public\s+class\s+(\w+)/);
        if (!classMatch) continue;

        const className = classMatch[1];
        return pkg ? `${pkg}.${className}` : className;
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
 * Run a Java multi-file project inside Docker.
 * Compiles with javac and runs the detected main class.
 *
 * @param {string} tempDir - Absolute path to temp directory containing project files
 * @returns {Promise<{stdout, stderr, exitCode, executionTime}>}
 */
async function run(tempDir, options = {}) {
    const { stdin } = options;
    const mainClass = detectMainClass(tempDir);

    if (!mainClass) {
        return {
            stdout: '',
            stderr: 'Could not find a main class.\n\nMake sure one of your .java files contains:\n  public static void main(String[] args)',
            exitCode: 1,
            executionTime: 0,
        };
    }

    console.log(`[Java] Detected main class: ${mainClass}`);

    // Build command:
    // 1. Make output dir inside the container (writable since we don't use --read-only)
    // 2. Find all .java source files
    // 3. Compile them into /app/out
    // 4. Run the main class
    const command = [
        'mkdir -p /app/out',
        'find /app -name "*.java" -not -path "*/out/*" > /tmp/sources.txt',
        `javac -d /app/out @/tmp/sources.txt 2>&1 || exit 1`,
        `java -cp /app/out ${mainClass}`,
    ].join(' && ');

    return await dockerRun(JAVA_IMAGE, tempDir, command, { stdin });
}

module.exports = { run };
