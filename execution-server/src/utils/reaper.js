const { spawn } = require('child_process');

const REAP_LABEL = 'collabspace=true';

const COMPILE_TIMEOUT_MS = parseInt(process.env.COMPILE_TIMEOUT_MS || '15000', 10);
const RUN_TIMEOUT_MS = parseInt(process.env.RUN_TIMEOUT_MS || '10000', 10);
const REAP_MARGIN_MS = parseInt(process.env.REAP_MARGIN_MS || '30000', 10);

// Total maximum execution window + safety margin
const DEFAULT_MAX_AGE_MS = COMPILE_TIMEOUT_MS + RUN_TIMEOUT_MS + REAP_MARGIN_MS;

// Active in-flight containers set: containerName -> timestamp
const inFlightContainers = new Set();

function registerInFlight(containerName) {
    if (containerName) {
        inFlightContainers.add(containerName);
    }
}

function unregisterInFlight(containerName) {
    if (containerName) {
        inFlightContainers.delete(containerName);
    }
}

/**
 * Runs a docker command and returns stdout as string.
 * Resolves empty string on failure (e.g. if Docker daemon is stopped).
 */
function execDocker(args) {
    return new Promise((resolve) => {
        let stdout = '';
        try {
            const proc = spawn('docker', args);
            proc.stdout.on('data', (d) => { stdout += d.toString(); });
            proc.stderr.on('data', () => {});
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
    unregisterInFlight(containerName);
    await execDocker(['rm', '-f', containerName]);
}

/**
 * Reaps orphaned collabspace containers.
 * Criteria:
 *  1. Must have label collabspace=true.
 *  2. Must NOT be in inFlightContainers set.
 *  3. In periodic mode, must be older than (max compile timeout + max run timeout + margin).
 *  4. In startup mode (all=true), removes any leftover containers from previous server runs.
 *
 * @param {boolean} [all=false]
 * @param {number} [maxAgeMs=DEFAULT_MAX_AGE_MS]
 * @returns {Promise<number>} Number of reaped containers
 */
async function reapContainers(all = false, maxAgeMs = DEFAULT_MAX_AGE_MS) {
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

        // Never reap a container that is currently in-flight
        if (inFlightContainers.has(name) || inFlightContainers.has(id)) {
            continue;
        }

        if (all) {
            toRemove.push(id);
        } else {
            const createdTime = Date.parse(createdAt);
            if (!isNaN(createdTime) && (Date.now() - createdTime > maxAgeMs)) {
                toRemove.push(id);
            }
        }
    }

    if (toRemove.length > 0) {
        console.log(`[reaper] Removing ${toRemove.length} stale container(s)...`);
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
    registerInFlight,
    unregisterInFlight,
    inFlightContainers,
    DEFAULT_MAX_AGE_MS,
};
