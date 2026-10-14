const { spawn } = require('child_process');

const REAP_LABEL = 'collabspace=true';
const DEFAULT_MAX_AGE_MS = 60 * 1000; // Containers older than 60s are considered stale

/**
 * Runs a docker command and returns stdout as string.
 * Resolves empty string on failure (e.g. if Docker daemon is stopped).
 */
function execDocker(args) {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        try {
            const proc = spawn('docker', args);
            proc.stdout.on('data', (d) => { stdout += d.toString(); });
            proc.stderr.on('data', (d) => { stderr += d.toString(); });
            proc.on('close', (code) => {
                if (code === 0) resolve(stdout.trim());
                else resolve('');
            });
            proc.on('error', () => resolve(''));
        } catch {
            resolve('');
        }
    });
}

/**
 * Forcefully kills and removes a specific container by name.
 * @param {string} containerName
 */
async function killContainer(containerName) {
    if (!containerName || !containerName.startsWith('collabspace-')) return;
    await execDocker(['rm', '-f', containerName]);
}

/**
 * Reaps all collabspace containers.
 * If all=true, kills every collabspace container (used at startup).
 * If all=false, kills containers older than maxAgeMs.
 *
 * @param {boolean} [all=false]
 * @param {number} [maxAgeMs=DEFAULT_MAX_AGE_MS]
 * @returns {Promise<number>} Number of reaped containers
 */
async function reapContainers(all = false, maxAgeMs = DEFAULT_MAX_AGE_MS) {
    // List all container IDs with the collabspace label
    const output = await execDocker([
        'ps', '-a',
        '--filter', `label=${REAP_LABEL}`,
        '--format', '{{.ID}}\t{{.CreatedAt}}\t{{.Names}}'
    ]);

    if (!output) return 0;

    const lines = output.split('\n').map(l => l.trim()).filter(Boolean);
    const toRemove = [];

    for (const line of lines) {
        const [id, createdAt, name] = line.split('\t');
        if (!id) continue;

        if (all) {
            toRemove.push(id);
        } else {
            // Check container age
            const createdTime = Date.parse(createdAt);
            if (isNaN(createdTime) || Date.now() - createdTime > maxAgeMs) {
                toRemove.push(id);
            }
        }
    }

    if (toRemove.length > 0) {
        console.log(`[reaper] Cleaning up ${toRemove.length} stale container(s)...`);
        await execDocker(['rm', '-f', ...toRemove]);
    }

    return toRemove.length;
}

/**
 * Startup reaper: cleans up any leftover containers from previous server runs.
 */
async function startupReaper() {
    try {
        const count = await reapContainers(true);
        if (count > 0) {
            console.log(`[reaper] Startup cleanup removed ${count} leftover container(s).`);
        }
    } catch (err) {
        // Non-fatal if Docker is not currently running
        console.warn('[reaper] Startup cleanup check skipped:', err.message);
    }
}

/**
 * Starts periodic reaper timer.
 * @param {number} intervalMs - Interval between reap checks (default 60s)
 * @returns {NodeJS.Timeout}
 */
function startReaperInterval(intervalMs = 60 * 1000) {
    const timer = setInterval(() => {
        reapContainers(false).catch(() => {});
    }, intervalMs);
    timer.unref();
    return timer;
}

module.exports = {
    reapContainers,
    startupReaper,
    startReaperInterval,
    killContainer,
};
