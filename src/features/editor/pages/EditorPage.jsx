import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import FileTree from '../components/FileTree';
import CodeEditor from '../components/CodeEditor';
import JSZip from 'jszip';
import { executeCode, isLanguageSupported, executeProject, isProjectLanguage } from '../../../services/codeExecutionService';
import {
    createRepositoryFile,
    createRepositoryFolder,
    deleteRepositoryFile,
    getRepositoryById,
    getRepositoryFiles,
    renameRepositoryFile,
} from '../../../services/repositoryService';
import { getWorkspaceById } from '../../../services/workspaceService';
import {
    createCommit,
    getCommitHistory,
    getCommitFiles,
    restoreCommitSnapshot,
    updateFileContent,
} from '../../../services/editorService';
import { buildFileTree, buildFilePathMap, detectLanguage } from '../../../utils/repository';
import {
    Save, Download, FolderDown, Plus, FolderPlus, GitCommit,
    X, History, Play, Terminal, Loader2,
    ChevronRight, ArrowLeft, PanelLeftClose, PanelLeft,
    CheckCircle2, AlertCircle, FileCode, Lock,
} from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';

export default function EditorPage() {
    const { repoId, workspaceId } = useParams();
    const { user } = useAuth();
    const { canEditFiles, canCommit } = usePermissions(workspaceId);

    const [workspace, setWorkspace] = useState(null);
    const [repository, setRepository] = useState(null);
    const [files, setFiles] = useState([]);
    const [tree, setTree] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Tabs
    const [openTabs, setOpenTabs] = useState([]);
    const [activeTabId, setActiveTabId] = useState(null);
    const [tabContents, setTabContents] = useState({});
    const [dirtyTabs, setDirtyTabs] = useState(new Set());

    // Saving
    const [saving, setSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState('');

    // Layout states: Resizable & Collapsible Explorer & Output
    const [explorerOpen, setExplorerOpen] = useState(true);
    const [explorerWidth, setExplorerWidth] = useState(240);
    const [isResizingExplorer, setIsResizingExplorer] = useState(false);
    const [showOutput, setShowOutput] = useState(false);
    const [outputHeight, setOutputHeight] = useState(200);
    const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

    // File creation modal
    const [fileFormOpen, setFileFormOpen] = useState(false);
    const [fileFormParentId, setFileFormParentId] = useState(null);
    const [fileFormType, setFileFormType] = useState('file');
    const [newItemName, setNewItemName] = useState('');
    const [createError, setCreateError] = useState('');
    const [creating, setCreating] = useState(false);

    // Commits
    const [commits, setCommits] = useState([]);
    const [commitsOpen, setCommitsOpen] = useState(false);
    const [commitDialogOpen, setCommitDialogOpen] = useState(false);
    const [commitMessage, setCommitMessage] = useState('');
    const [committing, setCommitting] = useState(false);

    // Download
    const [downloadingFile, setDownloadingFile] = useState(false);
    const [downloadingRepo, setDownloadingRepo] = useState(false);

    // Execution
    const [running, setRunning] = useState(false);
    const [executionOutput, setExecutionOutput] = useState(null);
    const outputRef = useRef(null);
    const [stdinValue, setStdinValue] = useState('');

    const buildSnapshotFiles = useCallback(() => (
        files.map((file) => {
            if (file.type !== 'file') return file;
            return {
                ...file,
                content: tabContents[file.id] ?? file.content ?? '',
            };
        })
    ), [files, tabContents]);

    const pathMap = useMemo(() => buildFilePathMap(files), [files]);

    /* ── Load data ── */
    useEffect(() => {
        if (!repoId) { setLoading(false); return; }
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [ws, repo, fileData] = await Promise.all([
                    workspaceId ? getWorkspaceById(workspaceId).catch(() => null) : null,
                    getRepositoryById(repoId),
                    getRepositoryFiles(repoId),
                ]);
                setWorkspace(ws);
                setRepository(repo);
                setFiles(fileData || []);
                setTree(buildFileTree(fileData || []));

                const firstFile = (fileData || []).find(f => f.type === 'file');
                if (firstFile) {
                    setOpenTabs([{ id: firstFile.id, name: firstFile.name }]);
                    setActiveTabId(firstFile.id);
                    setTabContents({ [firstFile.id]: firstFile.content ?? '' });
                }
            } catch (e) {
                setError(e.message || 'Failed to load editor');
            }
            setLoading(false);
        };
        load();
    }, [repoId, workspaceId]);

    useEffect(() => {
        if (!repoId) return;
        getCommitHistory(repoId).then(setCommits).catch(() => { });
    }, [repoId]);

    useEffect(() => {
        setTree(buildFileTree(files));
    }, [files]);

    // Resizer logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizingExplorer) return;
            const newWidth = Math.max(160, Math.min(480, e.clientX));
            setExplorerWidth(newWidth);
        };
        const handleMouseUp = () => setIsResizingExplorer(false);

        if (isResizingExplorer) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingExplorer]);

    const handleSelectFile = useCallback((fileId) => {
        const file = files.find(f => f.id === fileId);
        if (!file || file.type === 'folder') return;
        setOpenTabs(prev => {
            if (prev.some(t => t.id === fileId)) return prev;
            return [...prev, { id: fileId, name: file.name }];
        });
        setActiveTabId(fileId);
        setTabContents(prev => {
            if (prev[fileId] !== undefined) return prev;
            return { ...prev, [fileId]: file.content ?? '' };
        });
    }, [files]);

    const handleContentChange = useCallback((value) => {
        if (!activeTabId) return;
        setTabContents(prev => ({ ...prev, [activeTabId]: value }));
        setDirtyTabs(prev => new Set(prev).add(activeTabId));
        setSavedMessage('');
    }, [activeTabId]);

    const handleCloseTab = useCallback((tabId, e) => {
        e?.stopPropagation();
        setOpenTabs(prev => {
            const next = prev.filter(t => t.id !== tabId);
            if (activeTabId === tabId) {
                const idx = prev.findIndex(t => t.id === tabId);
                const newActive = next[Math.min(idx, next.length - 1)]?.id || null;
                setActiveTabId(newActive);
            }
            return next;
        });
        setTabContents(prev => { const c = { ...prev }; delete c[tabId]; return c; });
        setDirtyTabs(prev => { const n = new Set(prev); n.delete(tabId); return n; });
    }, [activeTabId]);

    const handleSave = async () => {
        if (!activeTabId) return;
        setSaving(true);
        setSavedMessage('');
        try {
            const updated = await updateFileContent({
                fileId: activeTabId,
                content: tabContents[activeTabId] ?? '',
                actorId: user?.id || null,
            });
            setFiles(prev => prev.map(f => f.id === updated.id ? updated : f));
            setDirtyTabs(prev => { const n = new Set(prev); n.delete(activeTabId); return n; });
            setSavedMessage('Saved');
            setTimeout(() => setSavedMessage(''), 1500);

            if (user?.id) {
                const commit = await createCommit({
                    repositoryId: repoId,
                    message: `Auto save: ${updated.name || 'file'}`,
                    createdBy: user.id,
                    files: buildSnapshotFiles(),
                });
                setCommits(prev => [commit, ...prev]);
            }
        } catch (e) {
            setError(e.message || 'Failed to save');
        }
        setSaving(false);
    };

    const handleCommit = async (e) => {
        e?.preventDefault();
        if (!commitMessage.trim() || !user) return;
        setCommitting(true);
        try {
            for (const dirtyId of dirtyTabs) {
                const content = tabContents[dirtyId];
                if (content !== undefined) {
                    const updated = await updateFileContent({
                        fileId: dirtyId,
                        content,
                        actorId: user?.id || null,
                    });
                    setFiles(prev => prev.map(f => f.id === updated.id ? updated : f));
                }
            }
            setDirtyTabs(new Set());

            const commit = await createCommit({
                repositoryId: repoId,
                message: commitMessage.trim(),
                createdBy: user.id,
                files: buildSnapshotFiles(),
            });
            setCommits(prev => [commit, ...prev]);
            setCommitMessage('');
            setCommitDialogOpen(false);
        } catch (e) {
            setError(e.message || 'Failed to commit');
        }
        setCommitting(false);
    };

    const handleCreateFile = useCallback((parentId) => {
        setFileFormParentId(parentId);
        setFileFormType('file');
        setFileFormOpen(true);
        setCreateError('');
        setNewItemName('');
    }, []);

    const handleCreateFolder = useCallback((parentId) => {
        setFileFormParentId(parentId);
        setFileFormType('folder');
        setFileFormOpen(true);
        setCreateError('');
        setNewItemName('');
    }, []);

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!newItemName.trim()) return;
        setCreating(true);
        setCreateError('');
        try {
            if (fileFormType === 'folder') {
                const created = await createRepositoryFolder({
                    repositoryId: repoId,
                    parentId: fileFormParentId,
                    name: newItemName.trim(),
                    actorId: user?.id || null,
                });
                setFiles(prev => [...prev, created]);
            } else {
                const created = await createRepositoryFile({
                    repositoryId: repoId,
                    parentId: fileFormParentId,
                    name: newItemName.trim(),
                    content: '',
                    actorId: user?.id || null,
                });
                setFiles(prev => [...prev, created]);
                handleSelectFile(created.id);
            }
            setFileFormOpen(false);
            setNewItemName('');
        } catch (err) {
            setCreateError(err.message || 'Failed to create');
        }
        setCreating(false);
    };

    const handleRenameFile = useCallback(async (fileId, newName) => {
        try {
            const updated = await renameRepositoryFile({ fileId, name: newName, actorId: user?.id || null });
            setFiles(prev => prev.map(f => f.id === updated.id ? updated : f));
            setOpenTabs(prev => prev.map(t => t.id === fileId ? { ...t, name: updated.name } : t));
        } catch (e) {
            setError(e.message || 'Failed to rename');
        }
    }, [user?.id]);

    const handleDeleteFile = useCallback(async (fileId) => {
        try {
            await deleteRepositoryFile({ fileId, actorId: user?.id || null });
            setFiles(prev => prev.filter(f => f.id !== fileId));
            handleCloseTab(fileId);
        } catch (e) {
            setError(e.message || 'Failed to delete');
        }
    }, [user?.id, handleCloseTab]);

    const handleDownloadCurrentFile = () => {
        if (!activeTabId) return;
        setDownloadingFile(true);
        try {
            const file = files.find(f => f.id === activeTabId);
            if (!file) return;
            const content = tabContents[activeTabId] ?? file.content ?? '';
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setDownloadingFile(false);
        }
    };

    const handleDownloadRepo = async () => {
        if (files.length === 0 || downloadingRepo) return;
        setDownloadingRepo(true);
        try {
            const zip = new JSZip();
            files.forEach(file => {
                if (file.type === 'file') {
                    const filePath = pathMap.get(file.id) || file.name;
                    const content = tabContents[file.id] ?? file.content ?? '';
                    zip.file(filePath, content);
                }
            });
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${repository?.name || 'repository'}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.message || 'Failed to download zip');
        } finally {
            setDownloadingRepo(false);
        }
    };

    const handleRunCode = async () => {
        if (!activeTabId || running) return;
        const file = files.find(f => f.id === activeTabId);
        if (!file) return;
        const lang = file.name || currentLanguage;
        setRunning(true);
        setShowOutput(true);
        setExecutionOutput(null);
        try {
            let result;
            if (isProjectLanguage(lang)) {
                const projectFiles = files
                    .filter(f => f.type === 'file')
                    .map(f => ({
                        path: pathMap.get(f.id) || f.name,
                        content: tabContents[f.id] ?? f.content ?? '',
                    }));
                const detectedLang = lang.toLowerCase().endsWith('.java') ? 'java'
                    : lang.toLowerCase().endsWith('.py') ? 'python'
                        : currentLanguage;
                const langFiles = projectFiles.filter(f =>
                    detectedLang === 'java' ? f.path.endsWith('.java') : f.path.endsWith('.py')
                );
                setExecutionOutput({
                    command: detectedLang === 'java'
                        ? `javac ${langFiles.map(f => f.path).join(' ')} && java <MainClass>`
                        : `python3 ${langFiles.find(f => f.path.includes('main.py'))?.path || langFiles[0]?.path || 'main.py'}`,
                    fileCount: langFiles.length,
                    language: detectedLang === 'java' ? 'Java' : 'Python',
                    version: detectedLang === 'java' ? 'OpenJDK 17' : 'Python 3.11',
                    phase: 'compiling',
                });
                result = await executeProject({ language: detectedLang, files: projectFiles, stdin: stdinValue || undefined });
                result.command = result.exitCode === 0
                    ? (detectedLang === 'java'
                        ? `javac (${langFiles.length} files) && java → exit 0`
                        : `python3 → exit 0`)
                    : (detectedLang === 'java'
                        ? `javac/java → exit ${result.exitCode}`
                        : `python3 → exit ${result.exitCode}`);
                result.fileCount = langFiles.length;
            } else if (isLanguageSupported(lang)) {
                result = await executeCode({ code: currentContent, language: lang });
                result.command = `run ${file.name}`;
            } else {
                result = { stdout: '', stderr: `Language not supported: ${lang}`, exitCode: 1, language: lang, version: '' };
            }
            setExecutionOutput(result);
        } catch (err) {
            setExecutionOutput({
                stdout: '',
                stderr: err.message,
                exitCode: 1,
                language: lang,
                version: '',
                command: 'execution failed',
            });
        }
        setRunning(false);
        setTimeout(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, 100);
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center text-xs text-text-dim">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={24} className="animate-spin text-accent" />
                    <span>Loading editor session...</span>
                </div>
            </div>
        );
    }

    if (!repository) {
        return (
            <div className="flex h-screen items-center justify-center text-xs text-text-dim">
                Repository not found.
            </div>
        );
    }

    const activeFile = files.find(f => f.id === activeTabId);
    const activePath = activeFile ? pathMap.get(activeFile.id) : '';
    const currentContent = activeTabId ? (tabContents[activeTabId] ?? '') : '';
    const currentLanguage = activeFile ? detectLanguage(activeFile.name) : 'plaintext';

    return (
        <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-canvas text-text-main select-none">
            {/* Slim Top Bar (40px, one row, 8px gaps) */}
            <header className="h-10 shrink-0 bg-surface border-b border-border-dim px-3 flex items-center justify-between gap-2 z-20">
                {/* Left: Back button + Breadcrumb (Workspace > Repo > File) */}
                <div className="flex items-center gap-2 min-w-0">
                    <Link
                        to={`/app/workspace/${workspaceId}`}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[10px] bg-black/5 dark:bg-white/6 hover:bg-black/8 dark:hover:bg-white/10 text-text-sub hover:text-text-main text-[11px] font-medium transition shrink-0"
                        title="Back to workspace overview"
                    >
                        <ArrowLeft size={13} />
                        <span className="hidden sm:inline">Back</span>
                    </Link>

                    <div className="h-4 w-px bg-border-dim shrink-0" />

                    {/* Collapsible explorer toggle button */}
                    <button
                        type="button"
                        onClick={() => setExplorerOpen(p => !p)}
                        className="h-7 w-7 rounded-[10px] flex items-center justify-center text-text-sub hover:text-text-main hover:bg-black/5 dark:hover:bg-white/6 transition shrink-0"
                        title={explorerOpen ? 'Hide Explorer' : 'Show Explorer'}
                    >
                        {explorerOpen ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
                    </button>

                    {/* Breadcrumbs with real names, no UUIDs */}
                    <nav className="flex items-center gap-1.5 text-xs text-text-sub min-w-0 truncate">
                        <span className="truncate font-medium text-text-main">
                            {workspace?.name || 'Workspace'}
                        </span>
                        <ChevronRight size={12} className="text-text-dim shrink-0" />
                        <span className="truncate text-text-sub font-medium">
                            {repository.name}
                        </span>
                        {activeFile && (
                            <>
                                <ChevronRight size={12} className="text-text-dim shrink-0" />
                                <span className="truncate text-text-main font-semibold">
                                    {activeFile.name}
                                </span>
                            </>
                        )}
                    </nav>
                </div>

                {/* Right Actions: One row, 8px gaps */}
                <div className="flex items-center gap-2 shrink-0">
                    {savedMessage && (
                        <span className="text-[11px] text-accent font-medium hidden sm:inline animate-fade-in">
                            {savedMessage}
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={() => setCommitDialogOpen(true)}
                        disabled={!canCommit}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[10px] bg-black/5 dark:bg-white/6 hover:bg-black/8 dark:hover:bg-white/10 text-text-main text-[11px] font-medium transition disabled:opacity-50"
                        title={canCommit ? 'Commit changes' : 'No permission'}
                    >
                        <GitCommit size={13} />
                        <span className="hidden sm:inline">Commit</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setCommitsOpen(p => !p)}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[10px] bg-black/5 dark:bg-white/6 hover:bg-black/8 dark:hover:bg-white/10 text-text-sub hover:text-text-main text-[11px] font-medium transition"
                        title="Commit history"
                    >
                        <History size={13} />
                        <span>{commits.length}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadCurrentFile}
                        disabled={!activeTabId || downloadingFile}
                        className="h-7 w-7 rounded-[10px] flex items-center justify-center text-text-sub hover:text-text-main hover:bg-black/5 dark:hover:bg-white/6 transition disabled:opacity-50"
                        title="Download file"
                    >
                        <Download size={13} />
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadRepo}
                        disabled={downloadingRepo || files.length === 0}
                        className="h-7 w-7 rounded-[10px] flex items-center justify-center text-text-sub hover:text-text-main hover:bg-black/5 dark:hover:bg-white/6 transition disabled:opacity-50"
                        title="Download zip"
                    >
                        <FolderDown size={13} />
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!activeTabId || saving || !canEditFiles}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[10px] bg-black/5 dark:bg-white/6 hover:bg-black/8 dark:hover:bg-white/10 text-text-main text-[11px] font-medium transition disabled:opacity-50"
                        title="Save file (Ctrl+S / Cmd+S)"
                    >
                        {!canEditFiles ? <Lock size={13} /> : <Save size={13} />}
                        <span>{saving ? 'Saving...' : 'Save'}</span>
                    </button>

                    {/* Run Button: Non-clipping, filled mint accent */}
                    <button
                        type="button"
                        onClick={handleRunCode}
                        disabled={!activeTabId || running}
                        className="inline-flex items-center justify-center gap-1.5 h-7 px-3.5 rounded-[10px] bg-accent text-on-accent text-[11px] font-semibold transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50 shrink-0 shadow-sm"
                        title="Run code in browser/container"
                    >
                        {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="fill-current" />}
                        <span>{running ? 'Running...' : 'Run'}</span>
                    </button>
                </div>
            </header>

            {/* Commit Dialog Modal */}
            {commitDialogOpen && (
                <div className="bg-surface border-b border-border-dim px-4 py-3 shrink-0 animate-fade-in z-20">
                    <form onSubmit={handleCommit} className="flex items-center gap-3">
                        <GitCommit size={16} className="text-accent shrink-0" />
                        <input
                            autoFocus
                            value={commitMessage}
                            onChange={e => setCommitMessage(e.target.value)}
                            placeholder="Commit message (e.g. 'Add palindrome logic')"
                            className="flex-1 bg-black/[.03] dark:bg-white/5 border border-border-dim rounded-[10px] px-3 py-1.5 text-xs text-text-main focus:outline-none focus:border-accent"
                        />
                        <button
                            type="button"
                            onClick={() => setCommitDialogOpen(false)}
                            className="px-3 py-1.5 rounded-[10px] text-xs text-text-sub hover:bg-black/5 dark:hover:bg-white/6"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={committing || !commitMessage.trim()}
                            className="px-3 py-1.5 rounded-[10px] bg-accent text-on-accent text-xs font-medium hover:brightness-105 disabled:opacity-50"
                        >
                            {committing ? 'Committing...' : 'Commit'}
                        </button>
                    </form>
                </div>
            )}

            {/* Main Editor Body */}
            <div className="flex-1 flex min-h-0 relative overflow-hidden">
                {/* Collapsible, Resizable Explorer Sidebar */}
                {explorerOpen && (
                    <aside
                        style={{ width: `${explorerWidth}px` }}
                        className="border-r border-border-dim bg-surface flex flex-col shrink-0 relative overflow-hidden select-none"
                    >
                        <div className="h-9 px-3 border-b border-border-dim flex items-center justify-between text-xs font-semibold text-text-sub uppercase tracking-wider">
                            <span>Explorer</span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => handleCreateFile(null)}
                                    className="p-1 rounded-[6px] hover:bg-black/5 dark:hover:bg-white/6 text-text-sub hover:text-text-main"
                                    title="New File"
                                >
                                    <Plus size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCreateFolder(null)}
                                    className="p-1 rounded-[6px] hover:bg-black/5 dark:hover:bg-white/6 text-text-sub hover:text-text-main"
                                    title="New Folder"
                                >
                                    <FolderPlus size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <FileTree
                                tree={tree}
                                currentFileId={activeTabId}
                                onSelectFile={handleSelectFile}
                                onCreateFile={handleCreateFile}
                                onCreateFolder={handleCreateFolder}
                                onRename={handleRenameFile}
                                onDelete={handleDeleteFile}
                            />
                        </div>

                        {/* Drag Handle */}
                        <div
                            onMouseDown={() => setIsResizingExplorer(true)}
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/40 transition-colors"
                        />
                    </aside>
                )}

                {/* Editor & Terminal Panel Center */}
                <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    {/* File Tabs Row with dirty dot */}
                    <div className="h-9 bg-surface border-b border-border-dim flex items-center px-1 overflow-x-auto custom-scrollbar shrink-0">
                        {openTabs.map(tab => {
                            const isActive = tab.id === activeTabId;
                            const isDirty = dirtyTabs.has(tab.id);

                            return (
                                <div
                                    key={tab.id}
                                    onClick={() => setActiveTabId(tab.id)}
                                    className={`group flex items-center gap-2 h-7 px-3 text-xs rounded-[8px] cursor-pointer transition select-none mr-1 ${
                                        isActive
                                            ? 'bg-canvas text-text-main font-medium border border-border-dim'
                                            : 'text-text-sub hover:text-text-main hover:bg-black/5 dark:hover:bg-white/6'
                                    }`}
                                >
                                    <span className="truncate max-w-[120px]">{tab.name}</span>

                                    {/* Dirty Dot */}
                                    {isDirty && (
                                        <span
                                            className="w-1.5 h-1.5 rounded-full bg-accent shrink-0"
                                            title="Unsaved changes"
                                        />
                                    )}

                                    <button
                                        type="button"
                                        onClick={(e) => handleCloseTab(tab.id, e)}
                                        className="opacity-0 group-hover:opacity-100 hover:text-semantic-danger transition p-0.5"
                                        title="Close tab"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Monaco Editor Container */}
                    <div className="flex-1 relative overflow-hidden bg-canvas">
                        {activeFile ? (
                            <CodeEditor
                                value={currentContent}
                                onChange={handleContentChange}
                                language={currentLanguage}
                                onCursorChange={setCursorPos}
                                onSaveShortcut={handleSave}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-xs text-text-dim">
                                Select or create a file in the explorer to start editing.
                            </div>
                        )}
                    </div>

                    {/* Bottom Terminal / Output Panel (Collapsible) */}
                    {showOutput && (
                        <div
                            style={{ height: `${outputHeight}px` }}
                            className="border-t border-border-dim bg-surface flex flex-col shrink-0 relative"
                        >
                            <div className="h-8 px-3 border-b border-border-dim flex items-center justify-between text-xs text-text-sub select-none">
                                <div className="flex items-center gap-2 font-medium">
                                    <Terminal size={14} className="text-accent" />
                                    <span>Output</span>
                                    {executionOutput && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                            executionOutput.exitCode === 0
                                                ? 'bg-semantic-success/15 text-semantic-success'
                                                : 'bg-semantic-danger/15 text-semantic-danger'
                                        }`}>
                                            exit: {executionOutput.exitCode ?? 0}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setExecutionOutput(null)}
                                        className="text-[11px] text-text-dim hover:text-text-main transition"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowOutput(false)}
                                        className="text-text-dim hover:text-text-main p-1 transition"
                                        title="Close terminal"
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            </div>

                            <div
                                ref={outputRef}
                                className="flex-1 overflow-y-auto custom-scrollbar p-3 font-mono text-xs bg-canvas text-text-main select-text"
                            >
                                {running ? (
                                    <div className="flex items-center gap-2 text-text-sub">
                                        <Loader2 size={13} className="animate-spin text-accent" />
                                        <span>Compiling and running code...</span>
                                    </div>
                                ) : executionOutput ? (
                                    <div className="space-y-1.5 whitespace-pre-wrap">
                                        {executionOutput.command && (
                                            <div className="text-text-dim text-[11px]">$ {executionOutput.command}</div>
                                        )}
                                        {executionOutput.stdout && (
                                            <div className="text-text-main">{executionOutput.stdout}</div>
                                        )}
                                        {executionOutput.stderr && (
                                            <div className="text-semantic-danger">{executionOutput.stderr}</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-text-dim text-[11px]">
                                        Terminal ready. Click 'Run' to execute.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 24px Status Bar */}
                    <footer className="h-6 shrink-0 bg-subtle border-t border-border-dim px-3 flex items-center justify-between text-[11px] text-text-dim select-none">
                        <div className="flex items-center gap-3">
                            <span className="font-medium text-text-sub uppercase">{currentLanguage}</span>
                            <span>UTF-8</span>
                            {showOutput ? (
                                <button
                                    type="button"
                                    onClick={() => setShowOutput(false)}
                                    className="hover:text-text-main transition"
                                >
                                    Hide Output
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowOutput(true)}
                                    className="hover:text-text-main transition"
                                >
                                    Show Output
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-3 font-mono">
                            <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
                            <span>
                                {dirtyTabs.has(activeTabId) ? (
                                    <span className="text-semantic-warning">○ Unsaved changes</span>
                                ) : (
                                    <span className="text-accent">● Saved</span>
                                )}
                            </span>
                        </div>
                    </footer>
                </div>
            </div>

            {/* Create File / Folder Modal */}
            {fileFormOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <form
                        onSubmit={handleCreateSubmit}
                        className="card-signature p-6 w-full max-w-sm space-y-4"
                    >
                        <h3 className="text-sm font-semibold text-text-main">
                            Create New {fileFormType === 'folder' ? 'Folder' : 'File'}
                        </h3>
                        <input
                            autoFocus
                            value={newItemName}
                            onChange={e => setNewItemName(e.target.value)}
                            placeholder={fileFormType === 'folder' ? 'folder-name' : 'filename.java'}
                            className="w-full h-10 px-3 rounded-[10px] bg-black/[.03] dark:bg-white/5 border border-border-dim text-xs text-text-main focus:outline-none focus:border-accent"
                        />
                        {createError && (
                            <p className="text-xs text-semantic-danger">{createError}</p>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setFileFormOpen(false)}
                                className="px-3 py-1.5 rounded-[10px] text-xs text-text-sub hover:bg-black/5 dark:hover:bg-white/6"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={creating || !newItemName.trim()}
                                className="px-3.5 py-1.5 rounded-[10px] bg-accent text-on-accent text-xs font-semibold hover:brightness-105 disabled:opacity-50"
                            >
                                {creating ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
