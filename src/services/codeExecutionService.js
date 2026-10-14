import { supabase } from '../lib/supabaseClient';

/**
 * Code Execution Service
 *
 * - Java & Python (multi-file, packages, imports):
 *     → Docker-based execution server at VITE_EXECUTION_SERVER_URL or http://localhost:4000/api/run
 * - All other languages (JS, C++, etc):
 *     → Judge0 CE free public instance
 */

// ─── Docker Execution Server ───────────────────────────────────────────────
const EXECUTION_SERVER_URL = import.meta.env.VITE_EXECUTION_SERVER_URL || 'http://localhost:4000/api/run';

/**
 * Languages that should use the Docker execution engine (multi-file support)
 */
const PROJECT_LANGUAGES = new Set(['java', 'python', 'py']);

/**
 * Check if a file/language uses the Docker multi-file executor.
 */
export function isProjectLanguage(fileNameOrLang) {
    if (!fileNameOrLang) return false;
    const lower = fileNameOrLang.toLowerCase();
    if (PROJECT_LANGUAGES.has(lower)) return true;
    const ext = lower.split('.').pop();
    return PROJECT_LANGUAGES.has(ext);
}

/**
 * Execute a full multi-file project using the Docker execution server.
 *
 * @param {Object} params
 * @param {string} params.language - "java" or "python"
 * @param {Array<{path: string, content: string}>} params.files - All project files with paths
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

// ─── Judge0 CE (single-file, all other languages) ──────────────────────────
const JUDGE0_API = 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_HOST = 'judge0-ce.p.rapidapi.com';
const JUDGE0_KEY = 'free'; // Free tier markers

// Fallback: use a free community instance that doesn't require API keys
const JUDGE0_FREE_API = 'https://ce.judge0.com';

// Language ID mapping for Judge0 CE
// Full list: https://ce.judge0.com/languages
const LANGUAGE_MAP = {
    // Extension-based and name-based mappings → Judge0 language_id
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
    'r': { id: 80, name: 'R (4.0.0)' },
    'lua': { id: 64, name: 'Lua (5.3.5)' },
    'pl': { id: 85, name: 'Perl (5.28.1)' },
    'perl': { id: 85, name: 'Perl (5.28.1)' },
    'sh': { id: 46, name: 'Bash (5.0.0)' },
    'bash': { id: 46, name: 'Bash (5.0.0)' },
    'scala': { id: 81, name: 'Scala (2.13.2)' },
    'sql': { id: 82, name: 'SQL (SQLite 3.27.2)' },
    'html': null, // Not executable
    'css': null,  // Not executable
    'json': null, // Not executable
    'md': null,   // Not executable
    'txt': null,  // Not executable
};

/**
 * Resolve a file name or language string to Judge0 language ID
 */
function resolveLanguage(fileNameOrLang) {
    if (!fileNameOrLang) return null;

    const lower = fileNameOrLang.toLowerCase();

    // Try direct match first (e.g. "python", "java")
    if (LANGUAGE_MAP[lower] !== undefined) return LANGUAGE_MAP[lower];

    // Try file extension (e.g. "main.py" → "py")
    const ext = lower.split('.').pop();
    if (ext && LANGUAGE_MAP[ext] !== undefined) return LANGUAGE_MAP[ext];

    return null;
}

/**
 * Base64 encode a string
 */
function btoa64(str) {
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch {
        return btoa(str);
    }
}

/**
 * Base64 decode a string
 */
function atob64(str) {
    if (!str) return '';
    try {
        return decodeURIComponent(escape(atob(str)));
    } catch {
        try { return atob(str); } catch { return str; }
    }
}

/**
 * Execute code using Judge0 CE API
 * @param {Object} params
 * @param {string} params.code - Source code to execute
 * @param {string} params.language - Language name or file name with extension
 * @param {string} [params.stdin] - Standard input to pass to the program
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, language: string, version: string}>}
 */
export async function executeCode({ code, language, stdin = '' }) {
    const resolved = resolveLanguage(language);
    if (!resolved) {
        const supported = Object.entries(LANGUAGE_MAP)
            .filter(([k, v]) => v !== null && k.length > 2)
            .map(([k]) => k)
            .join(', ');
        throw new Error(
            `Unsupported language: "${language}". Supported: ${supported}`
        );
    }

    // Submit the code for execution
    const submitResponse = await fetch(`${JUDGE0_FREE_API}/submissions?base64_encoded=true&wait=true`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
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

    // If we didn't get the result immediately (wait=true should handle it),
    // poll for it
    if (result.token && !result.status) {
        return await pollResult(result.token);
    }

    return formatResult(result);
}

/**
 * Poll for execution result using token
 */
async function pollResult(token) {
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const response = await fetch(
            `${JUDGE0_FREE_API}/submissions/${token}?base64_encoded=true`,
            { headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.ok) continue;

        const result = await response.json();

        // Status IDs: 1=In Queue, 2=Processing, 3=Accepted, 4+=Error/other
        if (result.status && result.status.id > 2) {
            return formatResult(result);
        }
    }

    throw new Error('Execution timed out — the server took too long to respond.');
}

/**
 * Format Judge0 result into our standard output format
 */
function formatResult(result) {
    const stdout = atob64(result.stdout || '');
    const stderr = atob64(result.stderr || '');
    const compileOutput = atob64(result.compile_output || '');
    const message = result.message || '';

    // Determine exit code from status
    // Status 3 = Accepted (success), anything else = error
    const exitCode = result.status?.id === 3 ? 0 : (result.exit_code ?? 1);

    let finalStderr = stderr;
    if (compileOutput) {
        finalStderr = compileOutput + (stderr ? '\n' + stderr : '');
    }
    if (message) {
        finalStderr = (finalStderr ? finalStderr + '\n' : '') + message;
    }

    // For TLE, MLE, etc. add the status description
    if (result.status?.id > 4 && result.status?.description) {
        finalStderr = (finalStderr ? finalStderr + '\n' : '') + `Status: ${result.status.description}`;
    }

    return {
        stdout: stdout,
        stderr: finalStderr,
        exitCode: exitCode,
        language: result.language?.name || '',
        version: '',
    };
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language) {
    const resolved = resolveLanguage(language);
    return resolved !== null;
}
