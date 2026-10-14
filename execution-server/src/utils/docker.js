const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { killContainer, registerInFlight, unregisterInFlight } = require('./reaper');

const COMPILE_TIMEOUT_MS = parseInt(process.env.COMPILE_TIMEOUT_MS || '15000', 10);
const RUN_TIMEOUT_MS = parseInt(process.env.RUN_TIMEOUT_MS || '10000', 10);

const JAVA_MEMORY_LIMIT = process.env.JAVA_MEMORY_LIMIT || '512m';
const PYTHON_MEMORY_LIMIT = process.env.PYTHON_MEMORY_LIMIT || '128m';
const CPU_LIMIT = process.env.CPU_LIMIT || '0.5';
const PIDS_LIMIT = process.env.PIDS_LIMIT || '64';
const CONTAINER_USER = process.env.CONTAINER_USER || 'sandbox';

const MAX_OUTPUT_BYTES = parseInt(process.env.MAX_OUTPUT_BYTES || String(256 * 1024), 10);      // 256 KB soft limit
const HARD_OUTPUT_LIMIT_BYTES = parseInt(process.env.HARD_OUTPUT_LIMIT_BYTES || String(1024 * 1024), 10); // 1 MB hard kill limit

/**
 * Builds the hardened Docker CLI argument array for running sandboxed code.
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
    const memoryLimit = options.memoryLimit ||
        (image.includes('java') ? JAVA_MEMORY_LIMIT : PYTHON_MEMORY_LIMIT);

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
        `--memory=${memoryLimit}`,                  // Memory limit (512m for Java, 128m for Python)
        `--memory-swap=${memoryLimit}`,             // Swap equal to memory (disables disk swap)
        `--cpus=${CPU_LIMIT}`,                      // CPU quota
        `--pids-limit=${PIDS_LIMIT}`,               // Process/thread count limit (anti fork-bomb)
        '--cap-drop=ALL',                           // Drop all Linux capabilities
        '--security-opt=no-new-privileges',         // Prevent privilege escalation
        `--user=${CONTAINER_USER}`,                 // Non-root sandbox user
        '--network=none',                           // Completely disable networking
        '--ulimit', 'nofile=256:512',               // Open file descriptors limit
        '--ulimit', 'fsize=10485760',               // Max file size limit (10 MB)
        '-v', `${normalizedDir}:/app:ro`,           // Mount source files as read-only (:ro)
        '--workdir', '/app',
    ];

    // Extra volume mounts if specified (e.g., compiled /out directory)
    if (Array.isArray(options.extraMounts)) {
        for (const mount of options.extraMounts) {
            dockerArgs.push('-v', mount);
        }
    }

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
 * @param {AbortSignal} [options.signal] - Cancellation abort signal from client
 * @param {boolean} [options.isCompile] - Whether this is a compilation step
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, executionTime: number, status: string}>}
 */
function dockerRun(image, tempDir, command, options = {}) {
    const defaultTimeout = options.isCompile ? COMPILE_TIMEOUT_MS : RUN_TIMEOUT_MS;
    const timeoutMs = options.timeoutMs || defaultTimeout;
    const runId = options.runId || uuidv4();
    const containerName = `collabspace-run-${runId}`;

    return new Promise((resolve) => {
        const startTime = Date.now();
        registerInFlight(containerName);

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
        let totalOutputBytes = 0;
        let outputTruncated = false;
        let killed = false;
        let killReason = null; // 'timeout' | 'output_limit' | 'client_cancel'

        const proc = spawn('docker', dockerArgs);

        // Cancel handling: if HTTP client disconnects or aborts
        if (options.signal) {
            if (options.signal.aborted) {
                cleanupAndResolve('cancelled', 130);
                return;
            }
            options.signal.addEventListener('abort', () => {
                if (!killed) {
                    killed = true;
                    killReason = 'client_cancel';
                    proc.kill('SIGKILL');
                    killContainer(containerName).catch(() => {});
                }
            }, { once: true });
        }

        // Send stdin to the process if provided
        if (options.stdin) {
            proc.stdin.write(options.stdin);
            proc.stdin.end();
        }

        function handleOutput(chunk, isStderr = false) {
            totalOutputBytes += chunk.length;

            // 1. Hard cap: terminate container immediately if output exceeds 1 MB
            if (totalOutputBytes > HARD_OUTPUT_LIMIT_BYTES) {
                if (!killed) {
                    killed = true;
                    killReason = 'output_limit';
                    stderr += '\n[Execution terminated: exceeded maximum output limit of 1 MB]';
                    proc.kill('SIGKILL');
                    killContainer(containerName).catch(() => {});
                }
                return;
            }

            // 2. Soft cap: truncate display output at 256 KB
            const currentTotal = stdout.length + stderr.length;
            if (currentTotal + chunk.length > MAX_OUTPUT_BYTES) {
                if (!outputTruncated) {
                    outputTruncated = true;
                    const remaining = Math.max(0, MAX_OUTPUT_BYTES - currentTotal);
                    const slice = chunk.slice(0, remaining).toString('utf8');
                    if (isStderr) stderr += slice;
                    else stdout += slice;
                    stdout += '\n[Output truncated: exceeded 256 KB limit]';
                }
            } else {
                if (isStderr) stderr += chunk.toString('utf8');
                else stdout += chunk.toString('utf8');
            }
        }

        proc.stdout.on('data', (chunk) => handleOutput(chunk, false));
        proc.stderr.on('data', (chunk) => handleOutput(chunk, true));

        // Enforce timeout
        const timer = setTimeout(() => {
            if (!killed) {
                killed = true;
                killReason = 'timeout';
                proc.kill('SIGKILL');
                killContainer(containerName).catch(() => {});
                stderr += `\n⏱ Execution timed out after ${timeoutMs / 1000}s`;
            }
        }, timeoutMs);

        async function cleanupAndResolve(finalStatus, exitCode) {
            clearTimeout(timer);
            unregisterInFlight(containerName);
            await killContainer(containerName).catch(() => {});
            const executionTime = Date.now() - startTime;

            resolve({
                stdout: stdout.trimEnd(),
                stderr: stderr.trimEnd(),
                exitCode,
                executionTime,
                status: finalStatus,
            });
        }

        proc.on('close', (code) => {
            const rawCode = killed ? (killReason === 'timeout' ? 124 : 137) : (code ?? 1);

            let status;
            if (killed && killReason === 'timeout') {
                status = 'timeout';
            } else if (killed && killReason === 'output_limit') {
                status = 'output_limit';
            } else if (killed && killReason === 'client_cancel') {
                status = 'cancelled';
            } else if (rawCode === 137 || stderr.includes('OutOfMemoryError') || stderr.includes('MemoryError')) {
                // Exit code 137 without timeout indicates Linux kernel OOM killer (SIGKILL)
                status = 'oom_killed';
            } else if (rawCode === 0) {
                status = 'ok';
            } else if (options.isCompile) {
                status = 'compile_error';
            } else {
                status = 'error';
            }

            cleanupAndResolve(status, rawCode);
        });

        proc.on('error', (err) => {
            cleanupAndResolve(
                'error',
                1
            );
        });
    });
}

module.exports = {
    dockerRun,
    buildDockerArgs,
    COMPILE_TIMEOUT_MS,
    RUN_TIMEOUT_MS,
    JAVA_MEMORY_LIMIT,
    PYTHON_MEMORY_LIMIT,
    CPU_LIMIT,
    PIDS_LIMIT,
    CONTAINER_USER,
    MAX_OUTPUT_BYTES,
    HARD_OUTPUT_LIMIT_BYTES,
};
