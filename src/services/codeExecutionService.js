import { supabase } from '../lib/supabaseClient';

/**
 * Code Execution Service
 *
 * - Java & Python (multi-file, packages, imports):
 *     → Docker-based execution server at VITE_EXECUTION_SERVER_URL or http://localhost:4000/api/run
 * - Other languages (Judge0 CE):
 *     → Disabled by default behind FEATURE_FLAG_ENABLE_JUDGE0. Browser calls to Judge0 are eliminated.
 */

// ─── Feature Flags ──────────────────────────────────────────────────────────
/**
 * Security feature flag: When false, all browser calls to external Judge0 APIs are disabled.
 * Only Java and Python are executable via the authenticated execution server.
 */
export const FEATURE_FLAG_ENABLE_JUDGE0 = false;

// ─── Docker Execution Server ───────────────────────────────────────────────
const EXECUTION_SERVER_URL = import.meta.env.VITE_EXECUTION_SERVER_URL || 'http://localhost:4000/api/run';

/**
 * Supported execution languages
 */
export const SUPPORTED_LANGUAGES = ['Java', 'Python'];
const PROJECT_LANGUAGES = new Set(['java', 'python', 'py']);

/**
 * Check if a file/language uses the Docker execution server.
 */
export function isProjectLanguage(fileNameOrLang) {
    if (!fileNameOrLang) return false;
    const lower = fileNameOrLang.toLowerCase();
    if (PROJECT_LANGUAGES.has(lower)) return true;
    const ext = lower.split('.').pop();
    return PROJECT_LANGUAGES.has(ext);
}

/**
 * Execute a full project using the Docker execution server.
 *
 * @param {Object} params
 * @param {string} params.language - "java" or "python"
 * @param {Array<{path: string, content: string}>} params.files - All project files with paths
 * @param {string} [params.stdin]
 * @returns {Promise<{stdout, stderr, exitCode, executionTime, language, version}>}
 */
export async function executeProject({ language, files, stdin }) {
    const lang = language.toLowerCase().replace(/^py$/, 'python');

    const headers = { 'Content-Type': 'application/json' };
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }
    } catch (authErr) {
        console.warn('Failed to get Supabase session for execution:', authErr);
    }

    let res;
    try {
        res = await fetch(EXECUTION_SERVER_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({ language: lang, files, stdin: stdin || undefined }),
        });
    } catch (err) {
        throw new Error(
            `Cannot connect to execution server at ${EXECUTION_SERVER_URL}.\n\nMake sure the execution server is running:\n  cd execution-server && node src/index.js`
        );
    }

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Execution server error (${res.status}): ${text}`);
    }

    const result = await res.json();
    return {
        ...result,
        language: lang.charAt(0).toUpperCase() + lang.slice(1),
        version: lang === 'java' ? 'OpenJDK 17' : 'Python 3.11',
    };
}

// ─── Legacy Judge0 Implementation (Preserved behind feature flag) ─────────
const JUDGE0_FREE_API = 'https://ce.judge0.com';

const LEGACY_LANGUAGE_MAP = {
    'java': { id: 62, name: 'Java (OpenJDK 13.0.1)' },
    'py': { id: 71, name: 'Python (3.8.1)' },
    'python': { id: 71, name: 'Python (3.8.1)' },
    'js': { id: 63, name: 'JavaScript (Node.js 12.14.0)' },
    'javascript': { id: 63, name: 'JavaScript (Node.js 12.14.0)' },
    'ts': { id: 74, name: 'TypeScript (3.7.4)' },
    'typescript': { id: 74, name: 'TypeScript (3.7.4)' },
    'c': { id: 50, name: 'C (GCC 9.2.0)' },
    'cpp': { id: 54, name: 'C++ (GCC 9.2.0)' },
    'c++': { id: 54, name: 'C++ (GCC 9.2.0)' },
    'cs': { id: 51, name: 'C# (Mono 6.6.0.161)' },
    'csharp': { id: 51, name: 'C# (Mono 6.6.0.161)' },
    'go': { id: 60, name: 'Go (1.13.5)' },
    'rs': { id: 73, name: 'Rust (1.40.0)' },
    'rust': { id: 73, name: 'Rust (1.40.0)' },
    'rb': { id: 72, name: 'Ruby (2.7.0)' },
    'ruby': { id: 72, name: 'Ruby (2.7.0)' },
    'php': { id: 68, name: 'PHP (7.4.1)' },
    'swift': { id: 83, name: 'Swift (5.2.3)' },
    'kt': { id: 78, name: 'Kotlin (1.3.70)' },
    'kotlin': { id: 78, name: 'Kotlin (1.3.70)' },
};

function resolveLegacyLanguage(fileNameOrLang) {
    if (!fileNameOrLang) return null;
    const lower = fileNameOrLang.toLowerCase();
    if (LEGACY_LANGUAGE_MAP[lower] !== undefined) return LEGACY_LANGUAGE_MAP[lower];
    const ext = lower.split('.').pop();
    if (ext && LEGACY_LANGUAGE_MAP[ext] !== undefined) return LEGACY_LANGUAGE_MAP[ext];
    return null;
}

function btoa64(str) {
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch {
        return btoa(str);
    }
}

function atob64(str) {
    if (!str) return '';
    try {
        return decodeURIComponent(escape(atob(str)));
    } catch {
        try { return atob(str); } catch { return str; }
    }
}

/**
 * Single-file execution entrypoint.
 * If Judge0 feature flag is disabled, browser calls are completely removed.
 */
export async function executeCode({ code, language, stdin = '' }) {
    if (!FEATURE_FLAG_ENABLE_JUDGE0) {
        if (isProjectLanguage(language)) {
            const ext = language.toLowerCase().endsWith('.py') ? 'py' : 'java';
            return await executeProject({
                language,
                files: [{ path: `Main.${ext}`, content: code }],
                stdin,
            });
        }
        throw new Error(
            'Browser calls to Judge0 are disabled. Only Java (.java) and Python (.py) are supported via the secure sandbox.'
        );
    }

    // ── Legacy Judge0 Execution Path (Only executed when FEATURE_FLAG_ENABLE_JUDGE0 is explicitly true) ──
    const resolved = resolveLegacyLanguage(language);
    if (!resolved) {
        throw new Error(`Unsupported language: "${language}".`);
    }

    const submitResponse = await fetch(`${JUDGE0_FREE_API}/submissions?base64_encoded=true&wait=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            language_id: resolved.id,
            source_code: btoa64(code),
            stdin: stdin ? btoa64(stdin) : '',
            cpu_time_limit: 5,
            wall_time_limit: 10,
            memory_limit: 128000,
        }),
    });

    if (!submitResponse.ok) {
        const text = await submitResponse.text();
        throw new Error(`Execution failed (${submitResponse.status}): ${text}`);
    }

    const result = await submitResponse.json();
    return formatLegacyResult(result);
}

function formatLegacyResult(result) {
    const stdout = atob64(result.stdout || '');
    const stderr = atob64(result.stderr || '');
    const compileOutput = atob64(result.compile_output || '');
    const message = result.message || '';
    const exitCode = result.status?.id === 3 ? 0 : (result.exit_code ?? 1);

    let finalStderr = stderr;
    if (compileOutput) {
        finalStderr = compileOutput + (stderr ? '\n' + stderr : '');
    }
    if (message) {
        finalStderr = (finalStderr ? finalStderr + '\n' : '') + message;
    }

    return {
        stdout,
        stderr: finalStderr,
        exitCode,
        language: result.language?.name || '',
        version: '',
    };
}

/**
 * Check if a language is supported for execution
 */
export function isLanguageSupported(language) {
    if (!FEATURE_FLAG_ENABLE_JUDGE0) {
        return isProjectLanguage(language);
    }
    return resolveLegacyLanguage(language) !== null;
}
