import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Trash2, Square, TerminalSquare, Maximize2, Minimize2 } from "lucide-react";

type Props = {
    repoId: string;
    language: string;
    wsBaseUrl: string;
    runTrigger: number;
    entryFile?: string;
};

export default function Terminal({ repoId, language, wsBaseUrl, runTrigger, entryFile }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const lastTriggerRef = useRef(0);
    const lineRef = useRef(""); // current line being typed
    const historyRef = useRef<string[]>([]);
    const histIdxRef = useRef(-1);
    const busyRef = useRef(false); // command running
    const cwdRef = useRef("/workspace");
    const pendingRunRef = useRef<object | null>(null); // run cmd to fire on WS open
    const [connected, setConnected] = useState(false);
    const [expanded, setExpanded] = useState(false);

    function sendWs(obj: object) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(obj));
        }
    }

    function showPrompt(term: XTerm, cwd: string) {
        term.write(`\r\n\x1b[36mcollabspace\x1b[0m:\x1b[33m${cwd}\x1b[0m$ `);
    }

    // ── xterm init ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current || termRef.current) return;

        const term = new XTerm({
            theme: {
                background: "#0a0a0f",
                foreground: "#e4e4e7",
                cursor: "#22d3ee",
                selectionBackground: "#22d3ee33",
                black: "#09090b",
                red: "#ef4444",
                green: "#22c55e",
                yellow: "#eab308",
                blue: "#3b82f6",
                magenta: "#a855f7",
                cyan: "#22d3ee",
                white: "#e4e4e7",
                brightBlack: "#52525b",
                brightRed: "#f87171",
                brightGreen: "#4ade80",
                brightYellow: "#facc15",
                brightBlue: "#60a5fa",
                brightMagenta: "#c084fc",
                brightCyan: "#67e8f9",
                brightWhite: "#fafafa",
            },
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 13,
            lineHeight: 1.4,
            cursorBlink: true,
            cursorStyle: "bar",
            scrollback: 10000,
            disableStdin: false,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);

        requestAnimationFrame(() => {
            try { fitAddon.fit(); } catch { }
            term.focus();
        });

        termRef.current = term;
        fitAddonRef.current = fitAddon;

        // Banner
        term.writeln("\x1b[36m┌────────────────────────────────────────────┐\x1b[0m");
        term.writeln("\x1b[36m│  CollabSpace IDE Terminal                  │\x1b[0m");
        term.writeln("\x1b[36m│  Ctrl+Enter to run • type commands below   │\x1b[0m");
        term.writeln("\x1b[36m└────────────────────────────────────────────┘\x1b[0m");

        // ── KEY HANDLER ──────────────────────────────────────────────────
        // Two modes:
        //  1. NORMAL (busyRef=false): local line editing — echo chars, send on Enter
        //  2. RUNNING (busyRef=true): program running — forward every keystroke as stdin
        term.onKey(({ key, domEvent }) => {
            const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

            // ── Ctrl+C always kills / resets ──
            if (domEvent.ctrlKey && domEvent.key === "c") {
                if (busyRef.current) {
                    // Kill running process
                    sendWs({ type: "kill" });
                    busyRef.current = false;
                    lineRef.current = "";
                } else {
                    term.write("^C\r\n");
                    lineRef.current = "";
                    showPrompt(term, cwdRef.current);
                }
                return;
            }

            // ── Ctrl+L clear ──
            if (domEvent.ctrlKey && domEvent.key === "l") {
                term.clear();
                if (!busyRef.current) showPrompt(term, cwdRef.current);
                return;
            }

            // ── RUNNING MODE: forward to process stdin ──
            if (busyRef.current) {
                if (domEvent.key === "Enter") {
                    term.write("\r\n");
                    sendWs({ type: "stdin", data: "\n" });
                } else if (domEvent.key === "Backspace") {
                    term.write("\b \b");
                    sendWs({ type: "stdin", data: "\b" });
                } else if (printable && key.length === 1) {
                    term.write(key);
                    sendWs({ type: "stdin", data: key });
                }
                return;
            }

            // ── NORMAL MODE: local line editing ──
            if (domEvent.key === "Enter") {
                const cmd = lineRef.current.trim();
                lineRef.current = "";
                histIdxRef.current = -1;
                term.write("\r\n");
                if (cmd) {
                    historyRef.current.unshift(cmd);
                    if (historyRef.current.length > 100) historyRef.current.pop();
                    busyRef.current = true;
                    sendWs({ type: "command", cmd });
                } else {
                    showPrompt(term, cwdRef.current);
                }
            } else if (domEvent.key === "Backspace") {
                if (lineRef.current.length > 0) {
                    lineRef.current = lineRef.current.slice(0, -1);
                    term.write("\b \b");
                }
            } else if (domEvent.key === "ArrowUp") {
                const hist = historyRef.current;
                if (hist.length > 0) {
                    histIdxRef.current = Math.min(histIdxRef.current + 1, hist.length - 1);
                    const entry = hist[histIdxRef.current];
                    term.write("\b \b".repeat(lineRef.current.length));
                    lineRef.current = entry;
                    term.write(entry);
                }
            } else if (domEvent.key === "ArrowDown") {
                const hist = historyRef.current;
                if (histIdxRef.current > 0) {
                    histIdxRef.current--;
                    const entry = hist[histIdxRef.current];
                    term.write("\b \b".repeat(lineRef.current.length));
                    lineRef.current = entry;
                    term.write(entry);
                } else if (histIdxRef.current === 0) {
                    histIdxRef.current = -1;
                    term.write("\b \b".repeat(lineRef.current.length));
                    lineRef.current = "";
                }
            } else if (printable && key.length === 1) {
                lineRef.current += key;
                term.write(key);
            }
        });


        const ro = new ResizeObserver(() => {
            try { fitAddon.fit(); } catch { }
        });
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            term.dispose();
            termRef.current = null;
            fitAddonRef.current = null;
        };
    }, []);

    // ── Store latest prop values in refs (avoid effect re-runs) ────────
    const languageRef = useRef(language);
    languageRef.current = language;
    const wsBaseUrlRef = useRef(wsBaseUrl);
    wsBaseUrlRef.current = wsBaseUrl;
    const entryFileRef = useRef(entryFile);
    entryFileRef.current = entryFile;

    // ── WebSocket connection (connect ONCE, auto-reconnect) ─────────────
    useEffect(() => {
        if (!repoId) return;
        let destroyed = false;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

        function connect() {
            if (destroyed) return;
            const wsUrl = `${wsBaseUrlRef.current}?repoId=${repoId}&language=${languageRef.current}`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                if (destroyed) { ws.close(); return; }
                setConnected(true);
                // Fire any run command that was queued before connection was ready
                if (pendingRunRef.current) {
                    const msgToSend = pendingRunRef.current;
                    pendingRunRef.current = null;
                    setTimeout(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify(msgToSend));
                            busyRef.current = true;
                        }
                    }, 500);
                }
            };

            ws.onmessage = (e) => {
                const term = termRef.current;
                if (!term) return;
                try {
                    const msg = JSON.parse(e.data);

                    if (msg.type === "output") {
                        term.write(msg.data);
                    } else if (msg.type === "prompt") {
                        cwdRef.current = msg.cwd || "/workspace";
                        busyRef.current = false;
                        showPrompt(term, cwdRef.current);
                        term.focus();
                    } else if (msg.type === "status") {
                        const color = msg.color === "green" ? "\x1b[32m"
                            : msg.color === "red" ? "\x1b[31m"
                                : "\x1b[33m";
                        term.writeln(`${color}[${msg.text}]\x1b[0m`);
                        if (msg.color === "green") {
                            showPrompt(term, cwdRef.current);
                            term.focus();
                        }
                    } else if (msg.type === "error") {
                        term.writeln(`\x1b[31m✗ ${msg.message}\x1b[0m`);
                    }
                } catch {
                    termRef.current?.write(e.data);
                }
            };

            ws.onclose = () => {
                setConnected(false);
                if (wsRef.current === ws) wsRef.current = null;
                // Auto-reconnect after 2s unless destroyed
                if (!destroyed) {
                    reconnectTimer = setTimeout(connect, 2000);
                }
            };

            ws.onerror = () => {
                termRef.current?.writeln("\x1b[31m✗ Terminal connection failed\x1b[0m");
            };
        }

        connect();

        return () => {
            destroyed = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repoId]);

    // ── Run trigger ──────────────────────────────────────────────────────
    useEffect(() => {
        if (runTrigger <= lastTriggerRef.current) return;
        lastTriggerRef.current = runTrigger;

        const lang = languageRef.current;
        const entry = entryFileRef.current || (lang === "java" ? "Main.java" : "main.py");
        const runMsg = { type: "run", language: lang, entry };

        // Try to send immediately, or retry up to 3s waiting for WS
        function trySend(retriesLeft: number) {
            const ws = wsRef.current;
            if (ws?.readyState === WebSocket.OPEN) {
                busyRef.current = true;
                ws.send(JSON.stringify(runMsg));
                return;
            }
            if (retriesLeft > 0) {
                setTimeout(() => trySend(retriesLeft - 1), 300);
            } else {
                // Last resort: queue for next WS open
                pendingRunRef.current = runMsg;
                termRef.current?.writeln("\x1b[33m⟳ Connecting to terminal...\x1b[0m");
            }
        }

        trySend(10); // retry up to 10 × 300ms = 3 seconds
    }, [runTrigger]);

    const handleClear = () => { termRef.current?.clear(); showPrompt(termRef.current!, cwdRef.current); };
    const handleKill = () => {
        sendWs({ type: "kill" });
        busyRef.current = false;
        termRef.current?.write("^C\r\n");
        showPrompt(termRef.current!, cwdRef.current);
    };
    const handleToggleExpand = () => {
        setExpanded(v => {
            setTimeout(() => { try { fitAddonRef.current?.fit(); } catch {} termRef.current?.focus(); }, 60);
            return !v;
        });
    };

    return (
        <div
            className={`h-full flex flex-col bg-[#0a0a0f] ${expanded ? "fixed inset-0 z-50" : ""}`}
            onClick={() => termRef.current?.focus()}
        >
            {/* Toolbar */}
            <div
                className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/50 shrink-0"
                onMouseDown={(e) => e.preventDefault()}
            >
                <div className="flex items-center gap-2">
                    <TerminalSquare className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Terminal</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
                    <span className="text-[9px] text-muted-foreground">{connected ? "Connected" : "Disconnected"}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button type="button" title="Send Ctrl+C" onMouseDown={e => e.preventDefault()} onClick={handleKill}
                        className="p-1 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
                        <Square className="h-3 w-3" />
                    </button>
                    <button type="button" title="Clear" onMouseDown={e => e.preventDefault()} onClick={handleClear}
                        className="p-1 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
                        <Trash2 className="h-3 w-3" />
                    </button>
                    <button type="button" title={expanded ? "Minimize" : "Maximize"} onMouseDown={e => e.preventDefault()} onClick={handleToggleExpand}
                        className="p-1 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
                        {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                    </button>
                </div>
            </div>

            {/* xterm viewport */}
            <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden px-1 py-1" />
        </div>
    );
}
