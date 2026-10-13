const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Creates an isolated temp directory for this execution run.
 * @param {string} runId - Unique UUID for this run
 * @returns {Promise<string>} Absolute path to the temp directory
 */
async function createTempDir(runId) {
    const dir = path.join(os.tmpdir(), `collabspace-${runId}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/**
 * Writes all project files to disk, recreating the full folder structure.
 * @param {string} baseDir - Temp directory root
 * @param {Array<{path: string, content: string}>} files
 */
async function writeFiles(baseDir, files) {
    for (const file of files) {
        if (!file.path || file.content === undefined) continue;

        // Sanitize: strip leading slashes to prevent path traversal
        const safePath = file.path.replace(/^[/\\]+/, '');
        const fullPath = path.join(baseDir, safePath);

        // Create parent directories
        const dir = path.dirname(fullPath);
        fs.mkdirSync(dir, { recursive: true });

        // Write file content
        fs.writeFileSync(fullPath, file.content || '', 'utf8');
    }
}

/**
 * Recursively deletes the temp directory.
 * @param {string} dir
 */
async function cleanup(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch (err) {
        console.warn(`[cleanup] Failed to remove ${dir}:`, err.message);
    }
}

module.exports = { createTempDir, writeFiles, cleanup };
