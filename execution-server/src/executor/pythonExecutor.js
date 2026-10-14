const path = require('path');
const { dockerRun } = require('../utils/docker');

const PYTHON_IMAGE = process.env.PYTHON_IMAGE || 'collabspace-python';

// Allowlist regex for Python filenames: alphanumeric, dashes, underscores, and forward slashes, ending with .py
const SAFE_PY_FILENAME_RE = /^[a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-]+)*\.py$/;

/**
 * Validates and detects the Python entry point file.
 * Priority: main.py > app.py > run.py > index.py > first valid .py file found
 *
 * @param {Array<{path: string, content: string}>} files
 * @returns {string} - Relative path to the entry file (e.g., "main.py" or "src/main.py")
 */
function detectEntryPoint(files) {
    if (!Array.isArray(files) || files.length === 0) {
        throw new Error('No files provided for execution.');
    }

    const pyFiles = files
        .filter(f => f && typeof f.path === 'string' && f.path.endsWith('.py'))
        .map(f => f.path.replace(/\\/g, '/').replace(/^\/+/, ''));

    if (pyFiles.length === 0) {
        throw new Error('No .py file found in project.');
    }

    // Validate every .py file candidate against allowlist
    for (const pyFile of pyFiles) {
        if (!SAFE_PY_FILENAME_RE.test(pyFile)) {
            throw new Error(
                `Invalid Python filename "${pyFile}". ` +
                'Filenames must contain only alphanumeric characters, dashes, underscores, and forward slashes, and end with .py.'
            );
        }
    }

    const priority = ['main.py', 'app.py', 'run.py', 'index.py'];

    // Check priority names at repo root first
    for (const name of priority) {
        if (pyFiles.includes(name)) return name;
    }

    // Check priority names anywhere (e.g., src/main.py)
    for (const name of priority) {
        const found = pyFiles.find(f => path.basename(f) === name);
        if (found) return found;
    }

    // Fall back to the first .py file
    const chosen = pyFiles[0];
    if (!SAFE_PY_FILENAME_RE.test(chosen)) {
        throw new Error(`Invalid entry point filename: "${chosen}".`);
    }
    return chosen;
}

/**
 * Run a Python multi-file project inside Docker.
 * Uses an argv array without shell invocation (sh -c) to eliminate command injection.
 *
 * @param {string} tempDir - Absolute path to temp directory
 * @param {Array<{path: string, content: string}>} files - All project files
 * @param {Object} [options]
 * @param {string} [options.stdin]
 * @returns {Promise<{stdout, stderr, exitCode, executionTime}>}
 */
async function run(tempDir, files, options = {}) {
    const { stdin } = options;
    const entryPoint = detectEntryPoint(files);
    console.log(`[Python] Entry point: ${entryPoint}`);

    // Direct argv execution without sh -c
    const argv = ['python3', '-u', `/app/${entryPoint}`];

    return await dockerRun(PYTHON_IMAGE, tempDir, argv, {
        stdin,
        env: { PYTHONPATH: '/app' },
    });
}

module.exports = { run, detectEntryPoint, SAFE_PY_FILENAME_RE };
