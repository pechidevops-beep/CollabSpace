const { spawn } = require('child_process');
const path = require('path');

const EXECUTION_TIMEOUT_MS = parseInt(process.env.EXECUTION_TIMEOUT_MS || '8000', 10);
const MEMORY_LIMIT = process.env.MEMORY_LIMIT || '128m';
const CPU_LIMIT = process.env.CPU_LIMIT || '0.5';

/**
 * Runs a command inside a Docker container with resource and network limits.
 *
 * @param {string} image - Docker image name (e.g. 'collabspace-java')
 * @param {string} tempDir - Absolute path to the temp dir (mounted as /app)
 * @param {string|string[]} command - Command to run inside the container
 * @param {Object} [options] - Additional options
 * @param {number} [options.timeoutMs] - Kill timeout in milliseconds
 * @param {string} [options.stdin] - Standard input to pipe to the process
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, executionTime: number}>}
 */
function dockerRun(image, tempDir, command, options = {}) {
    const { timeoutMs = EXECUTION_TIMEOUT_MS, stdin = '' } = options;
    return new Promise((resolve) => {
        const startTime = Date.now();

        // Normalize path for Docker on Windows (Docker Desktop uses Linux containers,
        // paths must use forward slashes and /c/... style on some setups)
        const normalizedDir = tempDir.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1');

        // Build docker arguments — keep flags simple for Docker Desktop on Windows
        const dockerArgs = [
            'run',
            '--rm',                      // Remove container after exit
            `--memory=${MEMORY_LIMIT}`,  // Memory limit
            `--cpus=${CPU_LIMIT}`,       // CPU limit
            '--network=none',            // No internet access
            '-v', `${normalizedDir}:/app`,  // Mount source files
            '--workdir', '/app',
        ];

        // Pass environment variables if specified
        if (options.env && typeof options.env === 'object') {
            for (const [key, val] of Object.entries(options.env)) {
                dockerArgs.push('-e', `${key}=${val}`);
            }
        }

        dockerArgs.push(image);

        // When command is an argv array and not marked as shell, execute directly without sh -c
        if (Array.isArray(command) && !options.shell) {
            dockerArgs.push(...command);
        } else {
            dockerArgs.push('sh', '-c', Array.isArray(command) ? command.join(' && ') : command);
        }

        // If stdin is provided, we need to pass -i flag for interactive input
        if (stdin) {
            dockerArgs.splice(1, 0, '-i');
        }

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
            stderr += `\n⏱ Execution timed out after ${timeoutMs / 1000}s`;
        }, timeoutMs);

        proc.on('close', (code) => {
            clearTimeout(timer);
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
            resolve({
                stdout: '',
                stderr: `Docker error: ${err.message}\n\nMake sure Docker Desktop is running and the image "${image}" is built.`,
                exitCode: 1,
                executionTime: Date.now() - startTime,
            });
        });
    });
}

module.exports = { dockerRun };
