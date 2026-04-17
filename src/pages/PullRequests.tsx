import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    GitPullRequest, GitMerge, GitBranch, ArrowLeft, Plus, X,
    MessageSquare, Check, Clock, AlertCircle, Send, FolderGit2, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import DiffViewer from "@/components/DiffViewer";

type PR = {
    id: string;
    repo_id: string;
    title: string;
    description: string;
    source_branch: string;
    target_branch: string;
    author_id: string;
    author_email: string;
    status: "open" | "merged" | "closed";
    created_at: string;
    merged_at: string | null;
};

type Comment = {
    id: string;
    user_email: string;
    body: string;
    created_at: string;
};

type PRDetail = {
    pr: PR;
    comments: Comment[];
    sourceFiles: { path: string; content: string }[];
    targetFiles: { path: string; content: string }[];
};

type Repo = { id: string; name: string };
type Branch = { id: string | null; name: string };

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const statusConfig = {
    open: { color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", icon: GitPullRequest, label: "Open" },
    merged: { color: "text-purple-400 bg-purple-400/10 border-purple-400/30", icon: GitMerge, label: "Merged" },
    closed: { color: "text-red-400 bg-red-400/10 border-red-400/30", icon: AlertCircle, label: "Closed" },
};

// ─── PR List ─────────────────────────────────────────────────────────
function PRList({
    repoId,
    repoName,
    onSelect,
    onBack,
}: {
    repoId: string;
    repoName: string;
    onSelect: (pr: PR) => void;
    onBack: () => void;
}) {
    const qc = useQueryClient();
    const [filter, setFilter] = useState<"open" | "merged" | "closed">("open");
    const [showNew, setShowNew] = useState(false);
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const [source, setSource] = useState("");
    const [target, setTarget] = useState("main");

    const { data: prs = [] } = useQuery({
        queryKey: ["pull-requests", repoId, filter],
        queryFn: () => apiFetch<PR[]>(`/pull-requests?repoId=${repoId}&status=${filter}`),
    });

    const { data: branches = [] } = useQuery({
        queryKey: ["branches", repoId],
        queryFn: () => apiFetch<Branch[]>(`/branches?repoId=${repoId}`),
    });

    const createPR = useMutation({
        mutationFn: () =>
            apiFetch("/pull-requests", {
                method: "POST",
                body: JSON.stringify({ repoId, title, description: desc, sourceBranch: source, targetBranch: target }),
            }),
        onSuccess: () => {
            toast.success("Pull request created!");
            setShowNew(false);
            setTitle("");
            setDesc("");
            qc.invalidateQueries({ queryKey: ["pull-requests", repoId] });
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Create failed"),
    });

    return (
        <div className="max-w-5xl mx-auto space-y-5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs h-7">
                        <ArrowLeft className="h-3 w-3" /> {repoName}
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <GitPullRequest className="h-5 w-5 text-primary" /> Pull Requests
                    </h1>
                </div>
                <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => setShowNew(!showNew)}>
                    <Plus className="h-4 w-4" /> New Pull Request
                </Button>
            </div>

            {/* Create PR form */}
            <AnimatePresence>
                {showNew && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="space-y-1 flex-1">
                                    <label className="text-xs text-muted-foreground">Source branch</label>
                                    <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={source} onChange={(e) => setSource(e.target.value)}>
                                        <option value="">Select branch</option>
                                        {branches.filter((b) => b.name !== target).map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div className="pt-5 text-muted-foreground">→</div>
                                <div className="space-y-1 flex-1">
                                    <label className="text-xs text-muted-foreground">Target branch</label>
                                    <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
                                        {branches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <input className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground" placeholder="PR title" value={title} onChange={(e) => setTitle(e.target.value)} />
                            <textarea className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground resize-none" rows={3} placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
                            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white" disabled={!title.trim() || !source || createPR.isPending} onClick={() => createPR.mutate()}>
                                <GitPullRequest className="h-4 w-4" /> Create Pull Request
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Filter tabs */}
            <div className="flex gap-1 border-b border-border">
                {(["open", "merged", "closed"] as const).map((s) => {
                    const cfg = statusConfig[s];
                    return (
                        <button key={s} onClick={() => setFilter(s)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${filter === s ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground"}`}>
                            <cfg.icon className="h-3.5 w-3.5" /> {cfg.label}
                        </button>
                    );
                })}
            </div>

            {/* PR list */}
            {prs.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                    No {filter} pull requests.
                </div>
            ) : (
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                    {prs.map((pr, i) => {
                        const cfg = statusConfig[pr.status];
                        return (
                            <div key={pr.id} onClick={() => onSelect(pr)}
                                className={`flex items-center gap-4 px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer ${i < prs.length - 1 ? "border-b border-border/50" : ""}`}>
                                <cfg.icon className={`h-4 w-4 shrink-0 ${cfg.color.split(" ")[0]}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{pr.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        #{pr.id.slice(0, 8)} by {pr.author_email?.split("@")[0]} · {pr.source_branch} → {pr.target_branch} · {timeAgo(pr.created_at)}
                                    </p>
                                </div>
                                <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── PR Detail ───────────────────────────────────────────────────────
function PRDetailView({
    prId,
    repoName,
    onBack,
}: {
    prId: string;
    repoName: string;
    onBack: () => void;
}) {
    const qc = useQueryClient();
    const [tab, setTab] = useState<"diff" | "comments">("diff");
    const [comment, setComment] = useState("");

    const { data, isLoading } = useQuery({
        queryKey: ["pull-request-detail", prId],
        queryFn: () => apiFetch<PRDetail>(`/pull-requests/${prId}`),
    });

    const mergePR = useMutation({
        mutationFn: () => apiFetch(`/pull-requests/${prId}/merge`, { method: "POST" }),
        onSuccess: () => {
            toast.success("Pull request merged!");
            qc.invalidateQueries({ queryKey: ["pull-request-detail", prId] });
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Merge failed"),
    });

    const addComment = useMutation({
        mutationFn: () =>
            apiFetch(`/pull-requests/${prId}/comments`, {
                method: "POST",
                body: JSON.stringify({ body: comment }),
            }),
        onSuccess: () => {
            setComment("");
            qc.invalidateQueries({ queryKey: ["pull-request-detail", prId] });
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Comment failed"),
    });

    if (isLoading || !data) return <div className="text-muted-foreground text-center py-12">Loading...</div>;

    const { pr, comments, sourceFiles, targetFiles } = data;
    const cfg = statusConfig[pr.status];

    // Build file diffs
    const fileMap = new Map<string, { old: string; new: string }>();
    for (const f of targetFiles) fileMap.set(f.path, { old: f.content, new: "" });
    for (const f of sourceFiles) {
        const existing = fileMap.get(f.path);
        if (existing) existing.new = f.content;
        else fileMap.set(f.path, { old: "", new: f.content });
    }
    // Remove files with no changes
    for (const [path, { old: o, new: n }] of fileMap) {
        if (o === n) fileMap.delete(path);
    }

    return (
        <div className="max-w-5xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs h-7 mb-2">
                        <ArrowLeft className="h-3 w-3" /> Back to PRs
                    </Button>
                    <h1 className="text-xl font-bold text-foreground">{pr.title}</h1>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                            <cfg.icon className="h-3 w-3 mr-1" /> {cfg.label}
                        </Badge>
                        <span>{pr.author_email?.split("@")[0]} wants to merge</span>
                        <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">{pr.source_branch}</code>
                        <span>→</span>
                        <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">{pr.target_branch}</code>
                        <span>· {timeAgo(pr.created_at)}</span>
                    </div>
                    {pr.description && <p className="text-sm text-muted-foreground mt-2">{pr.description}</p>}
                </div>

                {pr.status === "open" && (
                    <Button className="gap-2 bg-purple-600 hover:bg-purple-500 text-white shrink-0" onClick={() => mergePR.mutate()} disabled={mergePR.isPending}>
                        <GitMerge className="h-4 w-4" /> {mergePR.isPending ? "Merging..." : "Merge"}
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
                <button
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 ${tab === "diff" ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground"}`}
                    onClick={() => setTab("diff")}>
                    <GitBranch className="h-3.5 w-3.5" /> Files Changed ({fileMap.size})
                </button>
                <button
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 ${tab === "comments" ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground"}`}
                    onClick={() => setTab("comments")}>
                    <MessageSquare className="h-3.5 w-3.5" /> Discussion ({comments.length})
                </button>
            </div>

            {/* Diff tab */}
            {tab === "diff" && (
                <div className="space-y-4">
                    {fileMap.size === 0 ? (
                        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                            No file changes between branches.
                        </div>
                    ) : (
                        Array.from(fileMap.entries()).map(([path, { old: o, new: n }]) => (
                            <div key={path}>
                                <div className="text-xs font-mono text-muted-foreground mb-1 flex items-center gap-2">
                                    {!o && <Badge variant="outline" className="text-[10px] text-emerald-400 bg-emerald-400/10">NEW</Badge>}
                                    {!n && <Badge variant="outline" className="text-[10px] text-red-400 bg-red-400/10">DELETED</Badge>}
                                    {o && n && <Badge variant="outline" className="text-[10px] text-yellow-400 bg-yellow-400/10">MODIFIED</Badge>}
                                    {path}
                                </div>
                                <DiffViewer oldContent={o} newContent={n} oldTitle={pr.target_branch} newTitle={pr.source_branch} />
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Comments tab */}
            {tab === "comments" && (
                <div className="space-y-4">
                    {comments.length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-4">No comments yet.</div>
                    )}
                    {comments.map((c) => (
                        <div key={c.id} className="rounded-lg border border-border bg-card p-4">
                            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{c.user_email?.split("@")[0]}</span>
                                <span>·</span>
                                <Clock className="h-3 w-3" />
                                <span>{timeAgo(c.created_at)}</span>
                            </div>
                            <p className="text-sm text-foreground">{c.body}</p>
                        </div>
                    ))}

                    {/* Add comment */}
                    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                        <textarea
                            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground resize-none"
                            rows={3}
                            placeholder="Write a comment..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                        <Button size="sm" className="gap-2" disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate()}>
                            <Send className="h-3.5 w-3.5" /> Comment
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main page ───────────────────────────────────────────────────────
const PullRequests = () => {
    const workspaceId = localStorage.getItem("activeWorkspaceId") || "";
    const [selectedRepoId, setSelectedRepoId] = useState<string>("");
    const [selectedRepoName, setSelectedRepoName] = useState<string>("");
    const [selectedPR, setSelectedPR] = useState<PR | null>(null);
    const [showRepoPicker, setShowRepoPicker] = useState(false);

    // Fetch all repos in the active workspace
    const { data: repos = [] } = useQuery({
        queryKey: ["repositories", workspaceId],
        queryFn: () => apiFetch<Repo[]>(`/repositories?workspaceId=${workspaceId}`),
        enabled: Boolean(workspaceId),
    });

    // Default to localStorage activeRepoId once repos load
    useEffect(() => {
        if (repos.length > 0 && !selectedRepoId) {
            const stored = localStorage.getItem("activeRepoId") || "";
            const storedName = localStorage.getItem("activeRepoName") || "";
            // Prefer stored if it exists in the workspace repos list
            const match = repos.find((r) => r.id === stored);
            if (match) {
                setSelectedRepoId(match.id);
                setSelectedRepoName(match.name);
            } else if (repos[0]) {
                // Fall back to first repo
                setSelectedRepoId(repos[0].id);
                setSelectedRepoName(repos[0].name);
            }
        }
    }, [repos, selectedRepoId]);

    const handleSelectRepo = (repo: Repo) => {
        setSelectedRepoId(repo.id);
        setSelectedRepoName(repo.name);
        localStorage.setItem("activeRepoId", repo.id);
        localStorage.setItem("activeRepoName", repo.name);
        setSelectedPR(null);
        setShowRepoPicker(false);
    };

    // No workspace set at all
    if (!workspaceId) {
        return (
            <div className="max-w-5xl mx-auto py-12 text-center">
                <GitPullRequest className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-lg font-medium text-foreground">No Workspace Selected</h2>
                <p className="text-sm text-muted-foreground mt-1">Open a workspace from the Workspaces page first.</p>
            </div>
        );
    }

    if (selectedPR && selectedRepoId) {
        return (
            <PRDetailView
                prId={selectedPR.id}
                repoName={selectedRepoName}
                onBack={() => setSelectedPR(null)}
            />
        );
    }

    // Repo picker dropdown overlay
    const RepoPicker = () => (
        <AnimatePresence>
            {showRepoPicker && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute top-full left-0 mt-1 z-50 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
                >
                    {repos.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground">No repositories found.</div>
                    ) : (
                        repos.map((repo) => (
                            <button
                                key={repo.id}
                                onClick={() => handleSelectRepo(repo)}
                                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-secondary/50 transition-colors text-left ${
                                    repo.id === selectedRepoId ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                                }`}
                            >
                                <FolderGit2 className="h-3.5 w-3.5 shrink-0" />
                                {repo.name}
                                {repo.id === selectedRepoId && <Check className="h-3 w-3 ml-auto" />}
                            </button>
                        ))
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );

    if (!selectedRepoId) {
        return (
            <div className="max-w-5xl mx-auto py-12 text-center">
                <GitPullRequest className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-lg font-medium text-foreground">Loading repositories...</h2>
                <p className="text-sm text-muted-foreground mt-1">Please wait while we load your repos.</p>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Repo switcher bar */}
            <div className="max-w-5xl mx-auto mb-4">
                <div className="relative inline-block">
                    <button
                        onClick={() => setShowRepoPicker(!showRepoPicker)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors text-sm"
                    >
                        <FolderGit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono font-medium text-foreground">{selectedRepoName}</span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <RepoPicker />
                </div>
                {showRepoPicker && (
                    <div className="fixed inset-0 z-40" onClick={() => setShowRepoPicker(false)} />
                )}
            </div>

            <PRList
                repoId={selectedRepoId}
                repoName={selectedRepoName}
                onSelect={(pr) => setSelectedPR(pr)}
                onBack={() => {}}
            />
        </div>
    );
};

export default PullRequests;
