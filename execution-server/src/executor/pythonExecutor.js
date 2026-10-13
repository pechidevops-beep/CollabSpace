const path = require('path');
const { dockerRun } = require('../utils/docker');

const PYTHON_IMAGE = process.env.PYTHON_IMAGE || 'collabspace-python';

/**
 * Detects the Python entry point file.
 * Priority: main.py > app.py > run.py > first .py file found
 *
 * @param {Array<{path: string, content: string}>} files
 * @returns {string} - Relative path to the entry file (e.g., "main.py" or "src/main.py")
 */
function detectEntryPoint(files) {
    const pyFiles = files
        .filter(f => f.path && f.path.endsWith('.py'))
        .map(f => f.path.replace(/^[/\\]+/, '')); // strip leading slashes

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
    return pyFiles[0] || 'main.py';
}

/**
 * Run a Python multi-file project inside Docker.
 *
 * @param {string} tempDir - Absolute path to temp directory
 * @param {Array<{path: string, content: string}>} files - All project files
 * @returns {Promise<{stdout, stderr, exitCode, executionTime}>}
 */
async function run(tempDir, files, options = {}) {
    const { stdin } = options;
    const entryPoint = detectEntryPoint(files);
    console.log(`[Python] Entry point: ${entryPoint}`);

    // Add the app directory to PYTHONPATH so that all imports resolve correctly
    // python3 -u = unbuffered output
    const command = `PYTHONPATH=/app python3 -u /app/${entryPoint}`;

    return await dockerRun(PYTHON_IMAGE, tempDir, command, { stdin });
}

module.exports = { run };
