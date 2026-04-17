import { WebSocketServer } from "ws";
import { spawn, execSync } from "node:child_process";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// ─── Docker availability ─────────────────────────────────────────────
let dockerAvailable = false;
try {
    execSync("docker info", { stdio: "ignore", timeout: 5000 });
    dockerAvailable = true;
    console.log("[terminal] Docker available");
} catch {
    console.log("[terminal] Docker not available — local mode");
}

// ─── Container registry ──────────────────────────────────────────────
const containers = new Map();
const SANDBOX_IMAGE = "collabspace-sandbox";

function containerName(repoId) {
    return `cs-${repoId.slice(0, 12)}`;
}
function removeContainer(name) {
    try { execSync(`docker rm -f ${name}`, { stdio: "ignore", timeout: 8000 }); } catch { }
}

function ensureContainer(repoId) {
    const name = containerName(repoId);
    try {
        const st = execSync(`docker inspect -f "{{.State.Running}}" ${name}`, { timeout: 5000 }).toString().trim();
        if (st === "true") { containers.set(repoId, name); return name; }
    } catch { }

    removeContainer(name);
    execSync(
        `docker run -d --name ${name} --memory 512m --cpus 1 --network none -w /workspace ${SANDBOX_IMAGE} tail -f /dev/null`,
        { timeout: 30000 }
    );
    containers.set(repoId, name);
    return name;
}

async function syncFiles(containerN, repoId) {
    const sb = supabaseAdmin();
    const { data: files } = await sb.from("repo_files").select("path,content").eq("repo_id", repoId);
    if (!files || files.length === 0) return;
    const tmp = await mkdtemp(path.join(tmpdir(), "cs-sync-"));
    try {
        for (const f of files) {
            if (f.path.endsWith("/")) continue;
            const abs = path.join(tmp, f.path);
            await mkdir(path.dirname(abs), { recursive: true });
            await writeFile(abs, f.content ?? "", "utf8");
        }
        execSync(`docker cp "${tmp}/." "${containerN}:/workspace/"`, { timeout: 15000 });
    } finally {
        await rm(tmp, { recursive: true, force: true }).catch(() => { });
    }
}

// ─── Is this command running a program (needs stdin + auto-sync)? ────
function isInteractiveRuntime(cmd) {
    const c = cmd.trim();
    return /^(python3?|java\b|node|ruby|php)\s+/.test(c)
        || /^(javac|g\+\+|gcc)\s+/.test(c)
        || /&&\s*(java|python3?|node)\s+/.test(c);
}

// ─── Safety check ────────────────────────────────────────────────────
const BLOCKED = [/rm\s+(-[a-zA-Z]*)?-?r.*\//i, /\bshutdown\b/i, /\breboot\b/i, /\bmkfs\b/i, /\bdd\s+if=/i];
function isBlocked(cmd) { return BLOCKED.some(p => p.test(cmd)); }

// ─── Build run command (Docker / Linux) ─────────────────────────────
function buildRunCmd(entry) {
    const ext = path.extname(entry).toLowerCase();
    if (ext === ".py") {
        return `PYTHONSAFEPATH=1 PYTHONDONTWRITEBYTECODE=1 python3 -u "${entry}"`;
    }
    if (ext === ".java") {
        const cls = path.basename(entry, ".java");
        return `mkdir -p /tmp/jbuild && javac -d /tmp/jbuild "${entry}" && java -cp /tmp/jbuild ${cls}`;
    }
    if (ext === ".js") return `node "${entry}"`;
    return `cat "${entry}"`;
}

// ─── Build run command (Local / Windows) ─────────────────────────────
function buildRunCmdLocal(entry) {
    const ext = path.extname(entry).toLowerCase();
    if (ext === ".py") {
        return `python -u "${entry}"`;
    }
    if (ext === ".java") {
        const cls = path.basename(entry, ".java");
        if (process.platform === "win32") {
            return `javac "${entry}" && java ${cls}`;
        }
        return `javac "${entry}" && java ${cls}`;
    }
    if (ext === ".js") return `node "${entry}"`;
    if (process.platform === "win32") return `type "${entry}"`;
    return `cat "${entry}"`;
}

// ─── Sync files locally (no Docker) ──────────────────────────────────
async function syncFilesLocal(repoId) {
    const sb = supabaseAdmin();
    const { data: files } = await sb.from("repo_files").select("path,content").eq("repo_id", repoId);
    if (!files || files.length === 0) return tmpdir();

    const workDir = path.join(tmpdir(), `cs-local-${repoId.slice(0, 12)}`);
    await mkdir(workDir, { recursive: true });

    for (const f of files) {
        if (f.path.endsWith("/")) continue;
        const abs = path.join(workDir, f.path);
        await mkdir(path.dirname(abs), { recursive: true });
        await writeFile(abs, f.content ?? "", "utf8");
    }
    return workDir;
}

// ─── Run command (interactive): keeps stdin open for input() calls ───
function spawnInteractive(containerN, cmd, cwd) {
    return spawn("docker", [
        "exec", "-i",
        "-w", cwd || "/workspace",
        containerN,
        "bash", "-c", cmd,
    ], { stdio: ["pipe", "pipe", "pipe"] });
}

// ─── Run command (simple): stdin=ignore, faster, no hang risk ────────
function spawnSimple(containerN, cmd, cwd) {
    return spawn("docker", [
        "exec",
        "-w", cwd || "/workspace",
        containerN,
        "bash", "-c", cmd,
    ], { stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * WebSocket protocol:
 *   Client→Server: { type:"command", cmd:"ls" }
 *   Client→Server: { type:"run",     entry:"main.py" }
 *   Client→Server: { type:"stdin",   data:"5\n" }    ← user input while program runs
 *   Client→Server: { type:"kill" }
 *   Server→Client: { type:"output",  data:"..." }
 *   Server→Client: { type:"prompt",  cwd:"..." }
 *   Server→Client: { type:"status",  text:"...", color:"green"|"red"|"yellow" }
 */
export function attachTerminalWS(server) {
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (req, socket, head) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        if (url.pathname !== "/ws/terminal") return;
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    });

    wss.on("connection", async (ws, req) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const repoId = url.searchParams.get("repoId");
        const language = url.searchParams.get("language") || "python";

        if (!repoId) { ws.send(JSON.stringify({ type: "status", text: "Missing repoId", color: "red" })); ws.close(); return; }

        const send = (obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };

        let cwd = dockerAvailable ? "/workspace" : tmpdir();
        let activeProc = null;   // currently running process (if any)
        let containerReady = false;
        let containerN = null;
        let localWorkDir = null; // for no-Docker local execution

        // ── Initial setup ──
        async function setup() {
            try {
                if (dockerAvailable) {
                    send({ type: "status", text: "Starting container...", color: "yellow" });
                    containerN = ensureContainer(repoId);
                    send({ type: "status", text: "Syncing files...", color: "yellow" });
                    await syncFiles(containerN, repoId);
                }
                containerReady = true;
                send({ type: "status", text: "Ready", color: "green" });
                send({ type: "prompt", cwd });
            } catch (err) {
                send({ type: "status", text: `Setup error: ${err.message}`, color: "red" });
                send({ type: "output", data: `\x1b[31m${err.message}\x1b[0m\r\nMake sure Docker is running and 'collabspace-sandbox' image exists.\r\n` });
            }
        }
        setup();

        // ── Execute a single command ──
        async function execCommand(cmd) {
            if (!cmd.trim()) { send({ type: "prompt", cwd }); return; }
            if (isBlocked(cmd)) {
                send({ type: "output", data: `\x1b[31mBlocked: '${cmd}' is not allowed\x1b[0m\r\n` });
                send({ type: "prompt", cwd });
                return;
            }

            // `cd` — track server-side cwd
            if (cmd.startsWith("cd ") || cmd === "cd") {
                if (containerN) {
                    // Docker mode: verify via docker exec
                    const target = cmd === "cd" ? "/workspace" : cmd.slice(3).trim();
                    const newCwd = target.startsWith("/") ? target : `${cwd}/${target}`;
                    const verify = spawn("docker", [
                        "exec", "-w", cwd, containerN, "bash", "-c", `cd "${newCwd}" && pwd`,
                    ], { stdio: ["ignore", "pipe", "pipe"] });
                    let out = "";
                    verify.stdout.on("data", d => out += d.toString());
                    verify.on("close", (code) => {
                        if (code === 0 && out.trim()) {
                            cwd = out.trim();
                        } else {
                            send({ type: "output", data: `\x1b[31mbash: cd: ${target}: No such file or directory\x1b[0m\r\n` });
                        }
                        send({ type: "prompt", cwd });
                    });
                    verify.on("error", () => { send({ type: "prompt", cwd }); });
                } else {
                    // Local mode: resolve path locally
                    const target = cmd === "cd" ? (localWorkDir || tmpdir()) : cmd.slice(3).trim();
                    const newCwd = path.isAbsolute(target) ? target : path.resolve(cwd, target);
                    try {
                        const { statSync } = await import("node:fs");
                        if (statSync(newCwd).isDirectory()) {
                            cwd = newCwd;
                        } else {
                            send({ type: "output", data: `\x1b[31mcd: not a directory: ${target}\x1b[0m\r\n` });
                        }
                    } catch {
                        send({ type: "output", data: `\x1b[31mcd: ${target}: No such file or directory\x1b[0m\r\n` });
                    }
                    send({ type: "prompt", cwd });
                }
                return;
            }

            const needsStdin = isInteractiveRuntime(cmd);

            // Auto-sync files before running any language program
            if (needsStdin && containerN) {
                try { await syncFiles(containerN, repoId); } catch { }
            }

            // Choose spawn mode (interactive or simple)
            if (needsStdin && containerN) {
                activeProc = spawnInteractive(containerN, cmd, cwd);
            } else if (containerN) {
                activeProc = spawnSimple(containerN, cmd, cwd);
            } else {
                // Local fallback (no Docker) — use pipe stdin for interactive support
                const localCwd = localWorkDir || cwd;
                const useStdin = needsStdin ? "pipe" : "ignore";
                activeProc = spawn(
                    process.platform === "win32" ? "cmd.exe" : "bash",
                    process.platform === "win32" ? ["/c", cmd] : ["-c", cmd],
                    { cwd: localCwd, stdio: [useStdin, "pipe", "pipe"] }
                );
            }

            activeProc.stdout.on("data", (d) => send({ type: "output", data: d.toString() }));
            activeProc.stderr.on("data", (d) => send({ type: "output", data: "\x1b[31m" + d.toString() + "\x1b[0m" }));
            activeProc.on("close", () => {
                activeProc = null;
                send({ type: "prompt", cwd });
            });
            activeProc.on("error", (err) => {
                send({ type: "output", data: `\x1b[31mError: ${err.message}\x1b[0m\r\n` });
                activeProc = null;
                send({ type: "prompt", cwd });
            });
        }

        // ── WebSocket message handler ──
        ws.on("message", async (raw) => {
            let msg;
            try { msg = JSON.parse(raw.toString()); } catch { return; }

            if (msg.type === "stdin") {
                // User typed while a program is running — pipe to process stdin
                if (activeProc && !activeProc.killed) {
                    try { activeProc.stdin.write(msg.data); } catch { }
                }
                return;
            }

            if (msg.type === "command") {
                if (!containerReady && !containerN) {
                    send({ type: "output", data: "\x1b[33mContainer not ready yet, please wait...\x1b[0m\r\n" });
                    return;
                }
                await execCommand(msg.cmd);
                return;
            }

            if (msg.type === "run") {
                const entry = msg.entry || (language === "java" ? "Main.java" : "main.py");
                // Always sync files before running via Run button
                if (containerN) {
                    send({ type: "output", data: `\x1b[36m▶ Syncing and running ${entry}...\x1b[0m\r\n` });
                    await syncFiles(containerN, repoId).catch(() => { });
                    const cmd = buildRunCmd(entry);
                    send({ type: "output", data: `\x1b[36m$ ${cmd}\x1b[0m\r\n` });
                    await execCommand(cmd);
                } else {
                    // Local mode — sync files to temp directory then run
                    send({ type: "output", data: `\x1b[36m▶ Syncing and running ${entry}...\x1b[0m\r\n` });
                    try {
                        localWorkDir = await syncFilesLocal(repoId);
                        cwd = localWorkDir;
                    } catch (err) {
                        send({ type: "output", data: `\x1b[31mSync error: ${err.message}\x1b[0m\r\n` });
                    }
                    const cmd = buildRunCmdLocal(entry);
                    send({ type: "output", data: `\x1b[36m$ ${cmd}\x1b[0m\r\n` });
                    await execCommand(cmd);
                }
                return;
            }

            if (msg.type === "kill") {
                if (activeProc && !activeProc.killed) {
                    try {
                        if (process.platform === "win32") {
                            execSync(`taskkill /pid ${activeProc.pid} /T /F`, { stdio: "ignore" });
                        } else {
                            activeProc.kill("SIGINT");
                        }
                    } catch { }
                }
                activeProc = null;
                send({ type: "output", data: "\x1b[33m^C\x1b[0m\r\n" });
                send({ type: "prompt", cwd });
                return;
            }
        });

        ws.on("close", () => {
            if (activeProc && !activeProc.killed) {
                try { activeProc.kill(); } catch { }
            }
        });
    });
}
