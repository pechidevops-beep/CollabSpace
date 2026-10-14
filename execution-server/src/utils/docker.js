const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { killContainer } = require('./reaper');

const EXECUTION_TIMEOUT_MS = parseInt(process.env.EXECUTION_TIMEOUT_MS || '8000', 10);
const MEMORY_LIMIT = process.env.MEMORY_LIMIT || '128m';
const CPU_LIMIT = process.env.CPU_LIMIT || '0.5';
const PIDS_LIMIT = process.env.PIDS_LIMIT || '64';
const CONTAINER_USER = process.env.CONTAINER_USER || 'sandbox';

/**
 * Builds the hardened Docker CLI argument array for running sandboxed code.
 * Exported for testing and execution.
 *
 * @param {object} params
 * @param {string} params.image
 * @param {string} params.tempDir
 * @param {string|string[]} params.command
 * @param {string} params.containerName
 * @param {string} params.runId
 * @param {object} [params.options]
 * @returns {string[]}
 */
function buildDockerArgs({ image, tempDir, command, containerName, runId, options = {} }) {
    // Normalize path for Docker on Windows (Linux containers expect /c/... style)
    const normalizedDir = tempDir.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1');

    const dockerArgs = [
        'run',
        '--rm',                                     // Auto-remove container upon exit
        '--name', containerName,                    // Unique container name
        '--label', 'collabspace=true',               // Label for container reaper
        '--label', `collabspace.runId=${runId}`,
        '--read-only',                              // Read-only root filesystem
        '--tmpfs', '/tmp:rw,nosuid,nodev,size=64m', // Size-limited in-memory tmpfs
        `--memory=${MEMORY_LIMIT}`,                 // Memory limit
        `--memory-swap=${MEMORY_LIMIT}`,            // Memory swap equal to memory (no swap to disk)
        `--cpus=${CPU_LIMIT}`,                      // CPU quota
        `--pids-limit=${PIDS_LIMIT}`,               // Process/thread count limit (anti fork-bomb)
        '--cap-drop=ALL',                           // Drop all Linux capabilities
        '--security-opt=no-new-privileges',         // Prevent privilege escalation
        `--user=${CONTAINER_USER}`,                 // Non-root sandbox user
        '--network=none',                           // Completely disable networking
        '-v', `${normalizedDir}:/app:ro`,           // Mount source files as read-only (:ro)
        '--workdir', '/app',
    ];

    // Pass environment variables if specified
    if (options.env && typeof options.env === 'object') {
        for (const [key, val] of Object.entries(options.env)) {
            dockerArgs.push('-e', `${key}=${val}`);
        }
    }

    // If stdin is provided, pass -i flag for interactive input
    if (options.stdin) {
        dockerArgs.splice(1, 0, '-i');
    }

    dockerArgs.push(image);

    // When command is an argv array and not marked as shell, execute directly without sh -c
    if (Array.isArray(command) && !options.shell) {
        dockerArgs.push(...command);
    } else {
        dockerArgs.push('sh', '-c', Array.isArray(command) ? command.join(' && ') : command);
    }

    return dockerArgs;
}

/**
 * Runs a command inside a Docker container with strict sandbox hardening.
 *
 * @param {string} image - Docker image name (e.g. 'collabspace-java')
 * @param {string} tempDir - Absolute path to the temp dir (mounted read-only as /app)
 * @param {string|string[]} command - Command or argv array to run inside container
 * @param {Object} [options] - Additional options
 * @param {number} [options.timeoutMs] - Kill timeout in milliseconds
 * @param {string} [options.stdin] - Standard input to pipe to the process
 * @param {string} [options.runId] - Run ID for tracing
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, executionTime: number}>}
 */
function dockerRun(image, tempDir, command, options = {}) {
    const { timeoutMs = EXECUTION_TIMEOUT_MS, stdin = '' } = options;
    const runId = options.runId || uuidv4();
    const containerName = `collabspace-run-${runId}`;

    return new Promise((resolve) => {
        const startTime = Date.now();

        const dockerArgs = buildDockerArgs({
            image,
            tempDir,
            command,
            containerName,
            runId,
            options,
        });

        let stdout = '';
        let stderr = '';
        let killed = false;

        const proc = spawn('docker', dockerArgs);

        // Send stdin to the process if provided
        if (stdin) {
            proc.stdin.write(stdin);
            proc.stdin.end();
        }

        // Capture output with size limits (256KB max each)
        const MAX_OUTPUT = 256 * 1024;
        proc.stdout.on('data', (chunk) => {
            if (stdout.length < MAX_OUTPUT) stdout += chunk.toString();
        });
        proc.stderr.on('data', (chunk) => {
            if (stderr.length < MAX_OUTPUT) stderr += chunk.toString();
        });

        // Enforce timeout
        const timer = setTimeout(() => {
            killed = true;
            proc.kill('SIGKILL');
            // Explicitly kill the container in Docker daemon by name
            killContainer(containerName).catch(() => {});
            stderr += `\n⏱ Execution timed out after ${timeoutMs / 1000}s`;
        }, timeoutMs);

        proc.on('close', (code) => {
            clearTimeout(timer);
            // Ensure container cleanup in daemon
            killContainer(containerName).catch(() => {});
            const executionTime = Date.now() - startTime;
            resolve({
                stdout: stdout.trimEnd(),
                stderr: stderr.trimEnd(),
                exitCode: killed ? 124 : (code ?? 1),
                executionTime,
            });
        });

        proc.on('error', (err) => {
            clearTimeout(timer);
            killContainer(containerName).catch(() => {});
            resolve({
                stdout: '',
                stderr: `Docker error: ${err.message}\n\nMake sure Docker Desktop is running and the image "${image}" is built.`,
                exitCode: 1,
                executionTime: Date.now() - startTime,
            });
        });
    });
}

module.exports = {
    dockerRun,
    buildDockerArgs,
    EXECUTION_TIMEOUT_MS,
    MEMORY_LIMIT,
    CPU_LIMIT,
    PIDS_LIMIT,
    CONTAINER_USER,
};
