import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, FolderGit2, Lock, Globe, FileCode2, GitCommitHorizontal,
  ArrowLeft, Copy, Check, Clock, TerminalSquare, ChevronRight,
  Folder, FileText, Code2, Eye, Upload, Download, Trash2, X, Settings,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { useMemo, useState, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const langDot: Record<string, string> = {
  Python: "bg-blue-400",
  Java: "bg-orange-400",
  JavaScript: "bg-yellow-400",
};

type Repo = {
  id: string;
  name: string;
  language?: string | null;
  files: number;
  visibility: "private" | "public";
  updatedAt: string;
  workspaceId: string;
};

type Workspace = {
  id: string;
  name: string;
  role: string;
};

type Commit = {
  id: string;
  repo_id: string;
  message: string;
  author_email: string;
  hash: string;
  created_at: string;
};

type Branch = {
  id: string | null;
  name: string;
  created_at: string | null;
  isDefault?: boolean;
};

type RepoFile = {
  id?: string;
  path: string;
  content: string;
  language: string | null;
};

// ─── Repo list view ──────────────────────────────────────────────────
function RepoList({
  repos,
  workspaceId,
  isAdmin,
  onOpenRepo,
  onOpenEditor,
}: {
  repos: Repo[];
  workspaceId: string | null;
  isAdmin: boolean;
  onOpenRepo: (repo: Repo) => void;
  onOpenEditor: (repo: Repo) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("Python");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [showNew, setShowNew] = useState(false);

  // Edit State
  const [editingRepo, setEditingRepo] = useState<Repo | null>(null);
  const [editName, setEditName] = useState("");
  const [editLanguage, setEditLanguage] = useState("Python");
  const [editVisibility, setEditVisibility] = useState<"private" | "public">("private");

  const createRepo = useMutation({
    mutationFn: () => {
      if (!workspaceId) throw new Error("Select a workspace first");
      return apiFetch<Repo>("/repositories", {
        method: "POST",
        body: JSON.stringify({ workspaceId, name, language, visibility }),
      });
    },
    onSuccess: () => {
      toast.success("Repository created");
      setName("");
      setShowNew(false);
      qc.invalidateQueries({ queryKey: ["repositories", workspaceId] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Create failed");
    },
  });

  const editRepo = useMutation({
    mutationFn: () => apiFetch<Repo>(`/repositories/${editingRepo?.id}`, {
      method: "PATCH",
      body: JSON.stringify({ workspaceId, name: editName, language: editLanguage, visibility: editVisibility })
    }),
    onSuccess: () => {
      toast.success("Repository updated");
      setEditingRepo(null);
      qc.invalidateQueries({ queryKey: ["repositories", workspaceId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const deleteRepo = useMutation({
    mutationFn: (id: string) => apiFetch(`/repositories/${id}?workspaceId=${workspaceId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Repository deleted");
      qc.invalidateQueries({ queryKey: ["repositories", workspaceId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Repositories</h1>
          <p className="text-sm text-muted-foreground mt-1">Browse and manage your code repositories.</p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
          onClick={() => setShowNew(!showNew)}
        >
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Create a new repository</h3>
              <div className="flex items-end gap-3 flex-wrap">
                <div className="space-y-1.5 flex-1 min-w-[180px]">
                  <label className="text-xs text-muted-foreground">Repository name</label>
                  <input className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="my-project" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Language</label>
                  <select className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option>Python</option><option>Java</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Visibility</label>
                  <select className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={visibility} onChange={(e) => setVisibility(e.target.value as "private" | "public")}>
                    <option value="private">🔒 Private</option><option value="public">🌐 Public</option>
                  </select>
                </div>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => createRepo.mutate()} disabled={createRepo.isPending || !name.trim()}>
                  <FolderGit2 className="h-4 w-4" /> Create repository
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!workspaceId && (
        <div className="text-sm text-muted-foreground p-4 rounded-lg bg-card border border-border text-center">Select a workspace from the Workspaces page first.</div>
      )}

      {/* Edit Repo Modal */}
      {editingRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-card-foreground mb-4">Edit Repository</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Name</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Language</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary"
                  value={editLanguage}
                  onChange={(e) => setEditLanguage(e.target.value)}
                >
                  <option>Python</option>
                  <option>Java</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Visibility</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary"
                  value={editVisibility}
                  onChange={(e) => setEditVisibility(e.target.value as "private" | "public")}
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setEditingRepo(null)}>Cancel</Button>
              <Button size="sm" onClick={() => editRepo.mutate()} disabled={editRepo.isPending || !editName.trim()}>Save changes</Button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="space-y-2">
        {repos.map((repo, i) => (
          <motion.div key={repo.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="rounded-lg border border-border bg-card px-5 py-4 hover:border-primary/30 transition-all cursor-pointer group"
            onClick={() => onOpenRepo(repo)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-primary font-mono text-sm hover:underline">{repo.name}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {repo.visibility === "private" ? <><Lock className="h-2.5 w-2.5 mr-1" /> Private</> : <><Globe className="h-2.5 w-2.5 mr-1" /> Public</>}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                {repo.language && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`h-2.5 w-2.5 rounded-full ${langDot[repo.language] || "bg-gray-400"}`} />
                    {repo.language}
                  </div>
                )}
                <span className="text-xs text-muted-foreground hidden sm:block">Updated {timeAgo(repo.updatedAt)}</span>

                {isAdmin && (
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingRepo(repo);
                        setEditName(repo.name);
                        setEditLanguage(repo.language || "Python");
                        setEditVisibility(repo.visibility);
                      }}
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10 mr-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete ${repo.name}? This cannot be undone.`)) {
                          deleteRepo.mutate(repo.id);
                        }
                      }}
                      disabled={deleteRepo.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); onOpenEditor(repo); }}>
                  <Code2 className="h-3 w-3" /> Code
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Repo detail view (GitHub-style) ─────────────────────────────────
function RepoDetail({
  repo,
  onBack,
  onOpenEditor,
}: {
  repo: Repo;
  onBack: () => void;
  onOpenEditor: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"code" | "commits" | "branches" | "setup">("code");
  const [copied, setCopied] = useState(false);
  const [viewingFile, setViewingFile] = useState<RepoFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Branch state
  const [newBranchName, setNewBranchName] = useState("");
  const [fromBranch, setFromBranch] = useState("main");
  const [showNewBranch, setShowNewBranch] = useState(false);

  const { data: files = [], refetch: refetchFiles } = useQuery({
    queryKey: ["repo-files", repo.id],
    queryFn: () => apiFetch<RepoFile[]>(`/repo-files?repoId=${repo.id}`),
  });

  const { data: commits = [] } = useQuery({
    queryKey: ["commits", repo.id],
    queryFn: () => apiFetch<Commit[]>(`/commits?repoId=${repo.id}`),
  });

  const { data: branches = [], refetch: refetchBranches } = useQuery({
    queryKey: ["branches", repo.id],
    queryFn: () => apiFetch<Branch[]>(`/branches?repoId=${repo.id}`),
  });

  const createBranch = useMutation({
    mutationFn: () =>
      apiFetch("/branches", {
        method: "POST",
        body: JSON.stringify({ repoId: repo.id, name: newBranchName, fromBranch }),
      }),
    onSuccess: () => {
      toast.success(`Branch '${newBranchName}' created!`);
      setNewBranchName("");
      setShowNewBranch(false);
      refetchBranches();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const deleteBranch = useMutation({
    mutationFn: (branchId: string) => apiFetch(`/branches/${branchId}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Branch deleted"); refetchBranches(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const deleteFile = useMutation({
    mutationFn: (fileId: string) => apiFetch(`/repo-files/${fileId}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("File deleted"); refetchFiles(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const content = await file.text();
      return apiFetch("/repo-files", {
        method: "POST",
        body: JSON.stringify({ repoId: repo.id, path: file.name, content }),
      });
    },
    onSuccess: () => { toast.success("File uploaded"); refetchFiles(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    for (const f of Array.from(selectedFiles)) {
      uploadFile.mutate(f);
    }
    e.target.value = "";
  };

  const handleDownload = (file: RepoFile) => {
    const blob = new Blob([file.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.path.split("/").pop() || "file";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCloneCmd = () => {
    navigator.clipboard.writeText(`collab init --repo ${repo.id} --token <YOUR_TOKEN>\ncollab pull`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileEntries = files.filter((f) => !f.path.endsWith("/")).sort((a, b) => a.path.localeCompare(b.path));
  const readmeFile = fileEntries.find((f) => f.path.toLowerCase() === "readme.md");

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs h-7">
            <ArrowLeft className="h-3 w-3" /> Repos
          </Button>
          <div className="h-4 w-px bg-border" />
          <FolderGit2 className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground font-mono">{repo.name}</h1>
          <Badge variant="outline" className="text-[10px]">{repo.visibility === "private" ? "Private" : "Public"}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={copyCloneCmd}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Clone"}
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7 bg-emerald-600 hover:bg-emerald-500 text-white" onClick={onOpenEditor}>
            <Code2 className="h-3 w-3" /> Open in Editor
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border overflow-x-auto">
        {[
          { key: "code", label: "Code", icon: Code2 },
          { key: "commits", label: `Commits (${commits.length})`, icon: GitCommitHorizontal },
          { key: "branches", label: `Branches (${branches.length})`, icon: GitBranch },
          { key: "setup", label: "Setup", icon: TerminalSquare },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors border-b-2 whitespace-nowrap ${tab === key ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab(key as typeof tab)}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ─── Code Tab ─── */}
      {tab === "code" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Latest commit bar + upload button */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/30 border-b border-border text-xs">
              <div className="flex items-center gap-3">
                {commits.length > 0 ? (
                  <>
                    <GitCommitHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono text-primary">{commits[0].hash.slice(0, 7)}</span>
                    <span className="text-muted-foreground">{commits[0].message}</span>
                    <span className="text-muted-foreground">{timeAgo(commits[0].created_at)}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">No commits yet</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3 w-3" /> Upload
                </Button>
              </div>
            </div>

            {/* File list */}
            {fileEntries.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No files yet — push files using the CLI, upload, or open in editor.
              </div>
            ) : (
              <div>
                {fileEntries.map((file, i) => (
                  <div key={file.path}
                    className={`flex items-center justify-between px-4 py-2 text-sm hover:bg-secondary/30 transition-colors group ${i < fileEntries.length - 1 ? "border-b border-border/50" : ""}`}
                  >
                    <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => setViewingFile(file)}>
                      <FileText className={`h-3.5 w-3.5 shrink-0 ${getFileColor(file.path)}`} />
                      <span className="font-mono text-sm hover:text-primary hover:underline truncate">{file.path}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Download" onClick={() => handleDownload(file)}>
                        <Download className="h-3 w-3" />
                      </button>
                      <button className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400" title="Delete"
                        onClick={() => { if (file.id && confirm(`Delete ${file.path}?`)) deleteFile.mutate(file.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* README.md rendering */}
          {readmeFile && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-secondary/30 text-xs font-medium text-foreground flex items-center gap-2">
                <BookIcon className="h-3.5 w-3.5 text-muted-foreground" />
                README.md
              </div>
              <div className="p-6 prose prose-invert prose-sm max-w-none
                prose-headings:text-foreground prose-p:text-muted-foreground
                prose-a:text-primary prose-code:text-primary prose-code:bg-secondary/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-black/50 prose-pre:border prose-pre:border-border
                prose-strong:text-foreground prose-li:text-muted-foreground
                prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5
                prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5
              ">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {readmeFile.content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Commits Tab ─── */}
      {tab === "commits" && (
        <div className="space-y-0">
          {commits.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No commits yet. Push your first commit using the collab CLI.
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              {commits.map((c, i) => (
                <div key={c.id}
                  className={`flex items-center gap-4 px-4 py-3 hover:bg-secondary/30 transition-colors ${i < commits.length - 1 ? "border-b border-border/50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.author_email?.split("@")[0] || "unknown"} committed {timeAgo(c.created_at)}
                    </p>
                  </div>
                  <code className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{c.hash.slice(0, 7)}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Branches Tab ─── */}
      {tab === "branches" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Manage branches for this repository. Create a new branch to work on features without affecting <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">main</code>.
            </p>
            <Button
              size="sm"
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
              onClick={() => setShowNewBranch(!showNewBranch)}
            >
              <Plus className="h-4 w-4" /> New Branch
            </Button>
          </div>

          {/* Create branch form */}
          <AnimatePresence>
            {showNewBranch && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-primary" /> Create a new branch
                  </h3>
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="space-y-1.5 flex-1 min-w-[180px]">
                      <label className="text-xs text-muted-foreground">Branch name</label>
                      <input
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="e.g. feature/login"
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Fork from</label>
                      <select
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        value={fromBranch}
                        onChange={(e) => setFromBranch(e.target.value)}
                      >
                        {branches.map((b) => (
                          <option key={b.name} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <Button
                      className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                      onClick={() => createBranch.mutate()}
                      disabled={createBranch.isPending || !newBranchName.trim()}
                    >
                      <GitBranch className="h-4 w-4" /> Create branch
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Branch name can contain letters, numbers, <code className="text-primary">-</code>, <code className="text-primary">_</code>, <code className="text-primary">/</code>, <code className="text-primary">.</code>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Branch list */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {branches.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No branches yet — the default <code className="text-primary">main</code> branch is always available.
              </div>
            ) : (
              branches.map((branch, i) => (
                <div
                  key={branch.name}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors ${
                    i < branches.length - 1 ? "border-b border-border/50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm text-foreground">{branch.name}</span>
                    {(branch.isDefault || branch.name === "main") && (
                      <span className="text-[10px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 px-1.5 py-0.5 rounded font-medium">default</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {branch.created_at && (
                      <span className="text-xs text-muted-foreground hidden sm:block">{timeAgo(branch.created_at)}</span>
                    )}
                    {!branch.isDefault && branch.name !== "main" && branch.id && (
                      <button
                        className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                        title="Delete branch"
                        onClick={() => {
                          if (confirm(`Delete branch '${branch.name}'?`)) deleteBranch.mutate(branch.id!);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Tip */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm text-muted-foreground flex items-start gap-2">
            <GitBranch className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>
              After creating a branch, go to <span className="text-primary font-medium">Pull Requests</span> to open a PR from one branch into another.
              You can also switch branches using the CLI: <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">collab checkout &lt;branch-name&gt;</code>
            </span>
          </div>
        </div>
      )}

      {/* ─── Setup Tab ─── */}
      {tab === "setup" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TerminalSquare className="h-4 w-4 text-primary" /> Quick Setup — Push existing files
            </h3>
            <div className="rounded-lg bg-black/50 p-4 font-mono text-xs leading-relaxed space-y-1">
              <p className="text-gray-500"># Install collab CLI</p>
              <p className="text-emerald-400">npm link ./cli</p>
              <p className="text-gray-500 mt-3"># Initialize your project</p>
              <p className="text-emerald-400">collab init --repo {repo.id} --token &lt;YOUR_JWT&gt;</p>
              <p className="text-gray-500 mt-3"># Add, commit, and push</p>
              <p className="text-emerald-400">collab add .</p>
              <p className="text-emerald-400">collab commit -m "Initial commit"</p>
              <p className="text-emerald-400">collab push</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TerminalSquare className="h-4 w-4 text-primary" /> Clone — Pull files to local
            </h3>
            <div className="rounded-lg bg-black/50 p-4 font-mono text-xs leading-relaxed space-y-1">
              <p className="text-gray-500"># Initialize and pull</p>
              <p className="text-emerald-400">mkdir {repo.name} && cd {repo.name}</p>
              <p className="text-emerald-400">collab init --repo {repo.id} --token &lt;YOUR_JWT&gt;</p>
              <p className="text-emerald-400">collab pull</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Command Reference</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["collab init", "Initialize project"],
                ["collab add .", "Stage all files"],
                ["collab check", "Show file status"],
                ["collab commit -m \"msg\"", "Create commit"],
                ["collab push", "Push to CollabSpace"],
                ["collab pull", "Pull from CollabSpace"],
                ["collab log", "View commit history"],
              ].map(([cmd, desc]) => (
                <div key={cmd} className="flex items-center gap-2">
                  <code className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{cmd}</code>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── File Preview Modal ─── */}
      <AnimatePresence>
        {viewingFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8"
            onClick={() => setViewingFile(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-2">
                  <FileText className={`h-4 w-4 ${getFileColor(viewingFile.path)}`} />
                  <span className="font-mono text-sm font-medium">{viewingFile.path}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleDownload(viewingFile)}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                  <button className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" onClick={() => setViewingFile(null)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <pre className="p-4 text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap">
                  {viewingFile.content}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getFileColor(name: string): string {
  if (name.endsWith(".java")) return "text-orange-400";
  if (name.endsWith(".py")) return "text-yellow-400";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "text-blue-400";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "text-yellow-300";
  if (name.endsWith(".json")) return "text-green-400";
  if (name.endsWith(".css")) return "text-purple-400";
  if (name.endsWith(".html")) return "text-red-400";
  if (name.endsWith(".md")) return "text-gray-400";
  return "text-muted-foreground";
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 1.75A.75.75 0 01.75 1h4.253c1.227 0 2.317.59 3 1.501A3.744 3.744 0 0111.006 1h4.245a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75h-4.507a2.25 2.25 0 00-1.591.659l-.622.621a.75.75 0 01-1.06 0l-.622-.621A2.25 2.25 0 005.258 13H.75a.75.75 0 01-.75-.75V1.75zm7.251 10.324l.004-5.073-.002-2.253A2.25 2.25 0 005.003 2.5H1.5v9h3.757a3.75 3.75 0 011.994.574zM8.755 4.75l-.004 7.322a3.752 3.752 0 011.992-.572H14.5v-9h-3.495a2.25 2.25 0 00-2.25 2.25z" />
    </svg>
  );
}

// ─── Main page ───────────────────────────────────────────────────────
const Repositories = () => {
  const navigate = useNavigate();
  const workspaceId = useMemo(() => localStorage.getItem("activeWorkspaceId"), []);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);

  const { data: repos = [] } = useQuery({
    queryKey: ["repositories", workspaceId],
    queryFn: () => apiFetch<Repo[]>(`/repositories?workspaceId=${workspaceId}`),
    enabled: Boolean(workspaceId),
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => apiFetch<Workspace[]>("/workspaces"),
  });

  const currentWorkspace = workspaces.find((w) => w.id === workspaceId);
  const isAdmin = ["admin", "owner"].includes(currentWorkspace?.role?.toLowerCase() ?? "");

  const openEditor = useCallback(
    (repo: Repo) => {
      localStorage.setItem("activeRepoId", repo.id);
      localStorage.setItem("activeRepoName", repo.name);
      navigate("/editor");
    },
    [navigate]
  );

  if (selectedRepo) {
    return (
      <RepoDetail
        repo={selectedRepo}
        onBack={() => setSelectedRepo(null)}
        onOpenEditor={() => openEditor(selectedRepo)}
      />
    );
  }

  return (
    <RepoList
      repos={repos}
      workspaceId={workspaceId}
      isAdmin={isAdmin}
      onOpenRepo={(repo) => {
        // Always update activeRepo so Pull Requests page picks it up
        localStorage.setItem("activeRepoId", repo.id);
        localStorage.setItem("activeRepoName", repo.name);
        setSelectedRepo(repo);
      }}
      onOpenEditor={openEditor}
    />
  );
};

export default Repositories;
