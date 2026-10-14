const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const {
    createTempDir,
    writeFiles,
    cleanup,
    MAX_FILES,
    MAX_SINGLE_FILE_BYTES,
    MAX_TOTAL_BYTES,
} = require('../utils/fileSystem');
const javaExecutor = require('../executor/javaExecutor');
const pythonExecutor = require('../executor/pythonExecutor');
const { rateLimiter } = require('../middleware/rateLimiter');
const { concurrencyLimiter } = require('../middleware/concurrency');

/**
 * POST /api/run
 * Protected by: requireAuth, rateLimiter, concurrencyLimiter
 * Body: { language: "java"|"python", files: [{ path, content }], stdin?: string }
 * Returns: { stdout, stderr, exitCode, executionTime, status }
 */
router.post('/', rateLimiter, concurrencyLimiter, async (req, res) => {
    const { language, files, stdin } = req.body;

    // ── Validation ──
    if (!language || !files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({
            error: 'Invalid request: language and files are required.',
            stdout: '',
            stderr: 'Invalid request: language and files are required.',
            exitCode: 1,
            executionTime: 0,
            status: 'compile_error',
        });
    }

    // File count limit
    if (files.length > MAX_FILES) {
        return res.status(400).json({
            error: `File limit exceeded: received ${files.length} files (maximum ${MAX_FILES}).`,
            stdout: '',
            stderr: `File count limit exceeded: ${files.length}/${MAX_FILES}`,
            exitCode: 1,
            executionTime: 0,
            status: 'compile_error',
        });
    }

    // Per-file and total size validation before touching disk
    let totalBytes = 0;
    for (const f of files) {
        if (!f || typeof f.path !== 'string') {
            return res.status(400).json({
                error: 'Invalid file entry: path is required.',
                stdout: '',
                stderr: 'Invalid file entry: path is required.',
                exitCode: 1,
                executionTime: 0,
                status: 'compile_error',
            });
        }
        const contentStr = typeof f.content === 'string' ? f.content : String(f.content || '');
        const byteLen = Buffer.byteLength(contentStr, 'utf8');
        if (byteLen > MAX_SINGLE_FILE_BYTES) {
            return res.status(400).json({
                error: `File "${f.path}" exceeds size limit of ${MAX_SINGLE_FILE_BYTES / 1024} KB.`,
                stdout: '',
                stderr: `File "${f.path}" too large (${Math.round(byteLen / 1024)} KB).`,
                exitCode: 1,
                executionTime: 0,
                status: 'compile_error',
            });
        }
        totalBytes += byteLen;
        if (totalBytes > MAX_TOTAL_BYTES) {
            return res.status(400).json({
                error: `Total files size exceeds limit of ${MAX_TOTAL_BYTES / (1024 * 1024)} MB.`,
                stdout: '',
                stderr: `Total project size too large (${Math.round(totalBytes / 1024)} KB).`,
                exitCode: 1,
                executionTime: 0,
                status: 'compile_error',
            });
        }
    }

    const lang = language.toLowerCase();
    if (!['java', 'python'].includes(lang)) {
        return res.status(400).json({
            error: `Unsupported language: "${language}". Supported: java, python.`,
            stdout: '',
            stderr: `Unsupported language: "${language}". Docker executor supports: java, python.`,
            exitCode: 1,
            executionTime: 0,
            status: 'compile_error',
        });
    }

    const runId = uuidv4();
    let tempDir = null;

    // Cancellation support: kill container if client closes connection
    const abortController = new AbortController();
    req.on('close', () => {
        if (!res.writableEnded) {
            abortController.abort();
        }
    });

    try {
        // 1. Create isolated temp directory
        tempDir = await createTempDir(runId);

        // 2. Write all project files recreating folder structure (with Java class name canonicalization)
        await writeFiles(tempDir, files);

        // 3. Execute inside Docker
        let result;
        if (lang === 'java') {
            result = await javaExecutor.run(tempDir, {
                stdin,
                runId,
                signal: abortController.signal,
            });
        } else {
            result = await pythonExecutor.run(tempDir, files, {
                stdin,
                runId,
                signal: abortController.signal,
            });
        }

        if (res.writableEnded) return;
        return res.json(result);

    } catch (err) {
        if (res.writableEnded) return;
        console.error(`[${runId}] Execution error:`, err.message);
        return res.status(500).json({
            error: err.message || 'Internal execution error.',
            stdout: '',
            stderr: err.message || 'Internal execution error.',
            exitCode: 1,
            executionTime: 0,
            status: 'error',
        });
    } finally {
        // 4. Always clean up temp directory
        if (tempDir) {
            await cleanup(tempDir);
        }
    }
});

module.exports = router;
