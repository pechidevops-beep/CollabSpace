const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { createTempDir, writeFiles, cleanup } = require('../utils/fileSystem');
const javaExecutor = require('../executor/javaExecutor');
const pythonExecutor = require('../executor/pythonExecutor');

/**
 * POST /api/run
 * Body: { language: "java"|"python", files: [{ path, content }] }
 * Returns: { stdout, stderr, exitCode, executionTime }
 */
router.post('/', async (req, res) => {
    const { language, files, stdin } = req.body;

    // ── Validation ──
    if (!language || !files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({
            stdout: '',
            stderr: 'Invalid request: language and files are required.',
            exitCode: 1,
            executionTime: 0,
        });
    }

    const lang = language.toLowerCase();
    if (!['java', 'python'].includes(lang)) {
        return res.status(400).json({
            stdout: '',
            stderr: `Unsupported language: "${language}". Docker executor supports: java, python.`,
            exitCode: 1,
            executionTime: 0,
        });
    }

    const runId = uuidv4();
    let tempDir = null;

    try {
        // 1. Create isolated temp directory
        tempDir = await createTempDir(runId);

        // 2. Write all project files recreating folder structure
        await writeFiles(tempDir, files);

        // 3. Execute inside Docker
        let result;
        if (lang === 'java') {
            result = await javaExecutor.run(tempDir, { stdin });
        } else {
            result = await pythonExecutor.run(tempDir, files, { stdin });
        }

        return res.json(result);

    } catch (err) {
        console.error(`[${runId}] Execution error:`, err.message);
        return res.json({
            stdout: '',
            stderr: err.message || 'Internal execution error.',
            exitCode: 1,
            executionTime: 0,
        });
    } finally {
        // 4. Always clean up temp directory
        if (tempDir) {
            await cleanup(tempDir);
        }
    }
});

module.exports = router;
