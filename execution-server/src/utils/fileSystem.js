const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Limits ──────────────────────────────────────────────────────────────────
const MAX_FILES = 50;
const MAX_SINGLE_FILE_BYTES = 512 * 1024;  // 512 KB per file
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;   // 2 MB total

// Characters allowed in file paths: alphanumeric, dash, underscore, dot, forward slash
const SAFE_PATH_RE = /^[a-zA-Z0-9_\-./]+$/;

/**
 * Creates an isolated temp directory for this execution run.
 * Sets directory permission mode to 0755 so container user (uid 999) can read it on Linux.
 *
 * @param {string} runId - Unique UUID for this run
 * @returns {Promise<string>} Absolute path to the temp directory
 */
async function createTempDir(runId) {
    if (!/^[0-9a-f\-]{36}$/i.test(runId)) {
        throw new Error('Invalid run ID format.');
    }
    const dir = path.join(os.tmpdir(), `collabspace-${runId}`);
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    try {
        fs.chmodSync(dir, 0o755);
    } catch { /* ignore on OS without POSIX mode */ }
    return dir;
}

/**
 * Validates and sanitizes a single file path against traversal attacks.
 * Returns the safe absolute path or throws.
 *
 * Rejects: null bytes, absolute paths, '..', symlinks, non-allowlisted chars.
 * Verifies: resolved path stays strictly inside baseDir.
 *
 * @param {string} baseDir - Absolute path to the sandbox root
 * @param {string} filePath - User-supplied relative file path
 * @returns {string} Safe absolute path inside baseDir
 */
function safePath(baseDir, filePath) {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('File path is required.');
    }

    // 1. Reject null bytes
    if (filePath.includes('\0')) {
        throw new Error(`Null byte detected in file path: "${filePath}"`);
    }

    // 2. Reject absolute paths (Windows drive letters, UNC, POSIX root)
    if (/^[A-Za-z]:/.test(filePath) || filePath.startsWith('//') || filePath.startsWith('\\\\')) {
        throw new Error(`Absolute path not allowed: "${filePath}"`);
    }

    // 3. Reject leading slashes (both / and \)
    if (filePath.startsWith('/') || filePath.startsWith('\\')) {
        throw new Error(`Leading slash not allowed in file path: "${filePath}"`);
    }

    // 4. Normalize separators to forward slashes
    let normalized = filePath.replace(/\\/g, '/');

    // Reject empty
    if (!normalized.trim()) {
        throw new Error('File path is empty after normalization.');
    }

    // 5. Reject '..' segments anywhere in path
    if (normalized.split('/').some(seg => seg === '..')) {
        throw new Error(`Path traversal detected: "${filePath}"`);
    }

    // 6. Allowlist characters
    if (!SAFE_PATH_RE.test(normalized)) {
        throw new Error(
            `Invalid characters in file path: "${filePath}". ` +
            'Only alphanumeric, dash, underscore, dot, and forward slash are allowed.'
        );
    }

    // 7. Reject hidden files/directories (starting with .)
    const segments = normalized.split('/');
    for (const seg of segments) {
        if (seg.startsWith('.') && seg.length > 1 && !seg.includes('.', 1)) {
            // This is a hidden file/dir like ".env", ".git"
            throw new Error(`Hidden file/directory not allowed: "${filePath}"`);
        }
    }

    // 8. Resolve and verify containment
    const resolved = path.resolve(baseDir, normalized);
    const baseDirResolved = path.resolve(baseDir);

    // Ensure resolved path starts with baseDir + separator (not just a prefix match)
    if (!resolved.startsWith(baseDirResolved + path.sep) && resolved !== baseDirResolved) {
        throw new Error(`Path escapes sandbox: "${filePath}"`);
    }

    return resolved;
}

/**
 * Strips comments and string/character literals from Java code before regex matching.
 * Handles single-line comments, block comments, standard string literals, and text blocks.
 *
 * @param {string} code
 * @returns {string} Code with comments and string literals replaced with spaces
 */
function stripCommentsAndStrings(code) {
    if (typeof code !== 'string') return '';
    return code.replace(
        /("""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*)/g,
        ' '
    );
}

/**
 * Returns the canonical Java file path if a public class/interface/enum/record
 * does not match the filename.
 *
 * Features:
 * - Strips comments and string literals to prevent false positives.
 * - Handles modifiers: final, abstract, sealed, non-sealed, strictfp.
 * - Handles types: class, interface, enum, record.
 * - Returns relative path matching the declared public type name.
 *
 * @param {string} filePath - User-supplied relative path
 * @param {string} content - File content
 * @returns {string} Canonical relative path
 */
function getJavaCanonicalPath(filePath, content) {
    if (!filePath.endsWith('.java') || typeof content !== 'string') {
        return filePath;
    }

    const sanitized = stripCommentsAndStrings(content);

    // Matches any combination of modifiers (final, abstract, sealed, non-sealed, strictfp)
    // with "public" in any position before class | interface | enum | record <Name>
    const typeRegex = /\b(?:(?:final|abstract|sealed|non-sealed|strictfp)\s+)*public\s+(?:(?:final|abstract|sealed|non-sealed|strictfp)\s+)*(?:class|interface|enum|record)\s+([A-Za-z0-9_$]+)/;
    const match = sanitized.match(typeRegex);
    if (!match) return filePath;

    const publicTypeName = match[1];
    const currentBaseName = path.basename(filePath, '.java');

    if (currentBaseName === publicTypeName) {
        return filePath;
    }

    const dir = path.dirname(filePath).replace(/\\/g, '/');
    return dir === '.' ? `${publicTypeName}.java` : `${dir}/${publicTypeName}.java`;
}

/**
 * Writes all project files to disk, recreating the full folder structure.
 * Validates every path, enforces file count and size limits, rejects symlinks,
 * canonicalizes Java filenames to match their public type names, and returns
 * a clear error instead of overwriting if a canonical target name already exists.
 *
 * Explicitly sets directory permissions to 0755 and file permissions to 0644.
 *
 * @param {string} baseDir - Temp directory root
 * @param {Array<{path: string, content: string}>} files
 */
async function writeFiles(baseDir, files) {
    if (!Array.isArray(files)) {
        throw new Error('Files must be an array.');
    }

    if (files.length > MAX_FILES) {
        throw new Error(`Too many files: ${files.length} (max ${MAX_FILES}).`);
    }

    let totalBytes = 0;
    const plannedTargets = new Map(); // targetPath -> originalPath

    // ── Pre-flight Pass: Size checks and collision prevention ──────────────────
    for (const file of files) {
        if (!file.path || file.content === undefined) continue;

        const content = typeof file.content === 'string' ? file.content : String(file.content);
        const contentBytes = Buffer.byteLength(content, 'utf8');

        if (contentBytes > MAX_SINGLE_FILE_BYTES) {
            throw new Error(
                `File "${file.path}" is ${contentBytes} bytes (max ${MAX_SINGLE_FILE_BYTES}).`
            );
        }

        totalBytes += contentBytes;
        if (totalBytes > MAX_TOTAL_BYTES) {
            throw new Error(`Total file size exceeds ${MAX_TOTAL_BYTES} bytes.`);
        }

        const targetPath = getJavaCanonicalPath(file.path, content);
        if (plannedTargets.has(targetPath)) {
            const existing = plannedTargets.get(targetPath);
            throw new Error(
                `Canonical Java filename collision: file "${file.path}" maps to "${targetPath}", ` +
                `which conflicts with "${existing}". Refusing to overwrite.`
            );
        }
        plannedTargets.set(targetPath, file.path);
    }

    // ── Write Pass: Create directories (0755) and write files (0644) ───────────
    for (const file of files) {
        if (!file.path || file.content === undefined) continue;

        const content = typeof file.content === 'string' ? file.content : String(file.content);
        const targetPath = getJavaCanonicalPath(file.path, content);
        const fullPath = safePath(baseDir, targetPath);

        const dir = path.dirname(fullPath);
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
        try {
            fs.chmodSync(dir, 0o755);
        } catch { /* ignore on non-POSIX filesystems */ }

        // Ensure directory does not escape sandbox via symlink
        const realDir = fs.realpathSync(dir);
        const realBase = fs.realpathSync(baseDir);
        if (realDir !== realBase && !realDir.startsWith(realBase + path.sep)) {
            throw new Error(`Symlink traversal detected in directory path: "${targetPath}"`);
        }

        // Check for symlink at target (in case a prior file created one)
        try {
            const stat = fs.lstatSync(fullPath);
            if (stat.isSymbolicLink()) {
                throw new Error(`Symlink detected at "${targetPath}", refusing to write.`);
            }
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        // Write file with explicit 0644 mode
        fs.writeFileSync(fullPath, content, { encoding: 'utf8', flag: 'w', mode: 0o644 });
        try {
            fs.chmodSync(fullPath, 0o644);
        } catch { /* ignore on non-POSIX filesystems */ }
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

module.exports = {
    createTempDir,
    writeFiles,
    cleanup,
    safePath,
    getJavaCanonicalPath,
    stripCommentsAndStrings,
    MAX_FILES,
    MAX_SINGLE_FILE_BYTES,
    MAX_TOTAL_BYTES,
};
