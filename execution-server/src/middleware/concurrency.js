// ── Concurrency & Queue Manager ─────────────────────────────────────────────
// Enforces:
// 1. Per-user concurrency cap (default: 1 concurrent run per user)
// 2. Global concurrency cap (default: 4 concurrent docker runs)
// 3. Bounded queue with timeout (default: max 20 queued, 15s timeout)
// 4. Returns 429 + Retry-After when limits/queue are exhausted

const MAX_CONCURRENT_RUNS = parseInt(process.env.MAX_CONCURRENT_RUNS || '4', 10);
const MAX_USER_CONCURRENCY = parseInt(process.env.MAX_USER_CONCURRENCY || '1', 10);
const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || '20', 10);
const QUEUE_TIMEOUT_MS = parseInt(process.env.QUEUE_TIMEOUT_MS || '15000', 10);

let activeGlobalRuns = 0;
const activeUserRuns = new Map(); // userId -> count
const queue = []; // Array<{ userId, resolve, reject, timer }>

function getUserActive(userId) {
    return activeUserRuns.get(userId) || 0;
}

function incUserActive(userId) {
    activeUserRuns.set(userId, getUserActive(userId) + 1);
}

function decUserActive(userId) {
    const current = getUserActive(userId);
    if (current <= 1) {
        activeUserRuns.delete(userId);
    } else {
        activeUserRuns.set(userId, current - 1);
    }
}

/**
 * Try to process the next eligible request in the queue.
 */
function processNext() {
    if (activeGlobalRuns >= MAX_CONCURRENT_RUNS || queue.length === 0) {
        return;
    }

    // Find the first request in queue whose user is not currently at max concurrency
    const index = queue.findIndex(item => getUserActive(item.userId) < MAX_USER_CONCURRENCY);
    if (index === -1) {
        return;
    }

    const [item] = queue.splice(index, 1);
    clearTimeout(item.timer);

    activeGlobalRuns++;
    incUserActive(item.userId);

    const release = createReleaseFn(item.userId);
    item.resolve(release);
}

function createReleaseFn(userId) {
    let released = false;
    return () => {
        if (released) return;
        released = true;
        activeGlobalRuns = Math.max(0, activeGlobalRuns - 1);
        decUserActive(userId);
        process.nextTick(processNext);
    };
}

/**
 * Acquires an execution slot or enqueues until a slot is available.
 * @param {string} userId
 * @returns {Promise<() => void>} release function
 */
function acquireSlot(userId) {
    return new Promise((resolve, reject) => {
        // 1. Check per-user concurrency limit
        if (getUserActive(userId) >= MAX_USER_CONCURRENCY) {
            const err = new Error(
                `Per-user concurrency limit reached (${MAX_USER_CONCURRENCY} active run). Please wait for your current execution to complete.`
            );
            err.statusCode = 429;
            err.retryAfter = 3;
            return reject(err);
        }

        // 2. If below global limit, grant immediately
        if (activeGlobalRuns < MAX_CONCURRENT_RUNS) {
            activeGlobalRuns++;
            incUserActive(userId);
            return resolve(createReleaseFn(userId));
        }

        // 3. Check bounded queue capacity
        if (queue.length >= MAX_QUEUE_SIZE) {
            const err = new Error(
                `Server execution queue is full (${MAX_QUEUE_SIZE} queued). Please try again shortly.`
            );
            err.statusCode = 429;
            err.retryAfter = 5;
            return reject(err);
        }

        // 4. Enqueue with timeout
        let timer;
        const queueItem = {
            userId,
            resolve,
            reject,
            timer: null,
        };

        timer = setTimeout(() => {
            const idx = queue.indexOf(queueItem);
            if (idx !== -1) {
                queue.splice(idx, 1);
                const err = new Error('Execution queue wait timeout exceeded.');
                err.statusCode = 429;
                err.retryAfter = 4;
                reject(err);
            }
        }, QUEUE_TIMEOUT_MS);

        queueItem.timer = timer;
        queue.push(queueItem);
    });
}

/**
 * Concurrency middleware for execution routes.
 */
async function concurrencyLimiter(req, res, next) {
    const userId = req.userId || req.ip || 'anon';

    try {
        const release = await acquireSlot(userId);
        req.releaseExecutionSlot = release;

        // Ensure slot is released if client aborts or response finishes
        let hasReleased = false;
        const doRelease = () => {
            if (!hasReleased) {
                hasReleased = true;
                release();
            }
        };

        res.on('finish', doRelease);
        res.on('close', doRelease);

        next();
    } catch (err) {
        const status = err.statusCode || 500;
        if (err.retryAfter) {
            res.setHeader('Retry-After', err.retryAfter);
        }
        return res.status(status).json({
            error: err.message,
            retryAfter: err.retryAfter || 3,
            queueStats: {
                active: activeGlobalRuns,
                queued: queue.length,
            },
        });
    }
}

/**
 * Get current stats (for monitoring / health)
 */
function getConcurrencyStats() {
    return {
        activeGlobalRuns,
        maxConcurrentRuns: MAX_CONCURRENT_RUNS,
        maxUserConcurrency: MAX_USER_CONCURRENCY,
        queued: queue.length,
        maxQueueSize: MAX_QUEUE_SIZE,
    };
}

/**
 * Reset helper for testing
 */
function resetConcurrency() {
    activeGlobalRuns = 0;
    activeUserRuns.clear();
    while (queue.length > 0) {
        const item = queue.pop();
        clearTimeout(item.timer);
    }
}

module.exports = {
    concurrencyLimiter,
    acquireSlot,
    getConcurrencyStats,
    resetConcurrency,
    MAX_CONCURRENT_RUNS,
    MAX_USER_CONCURRENCY,
    MAX_QUEUE_SIZE,
};
