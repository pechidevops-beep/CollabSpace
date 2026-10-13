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
import {
    createCommit,
    getCommitHistory,
    getCommitFiles,
    restoreCommitSnapshot,
    updateFileContent,
} from '../../../services/editorService';
import { buildFileTree, buildFilePathMap, detectLanguage } from '../../../utils/repository';
import {
    Save, Download, FolderDown, Plus, GitCommit,
    X, Circle, History, Play, Terminal, ChevronDown, ChevronUp, Loader2,
    RotateCcw, FileCode, ChevronRight, User, Lock,
} from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';

export default function EditorPage() {
    const { repoId, workspaceId } = useParams();
    const { user } = useAuth();
    const { canEditFiles, canCommit } = usePermissions(workspaceId);

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

    // File creation
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

    // Commit history detail
    const [expandedCommitId, setExpandedCommitId] = useState(null);
    const [commitFilesList, setCommitFilesList] = useState([]);
    const [commitFilesLoading, setCommitFilesLoading] = useState(false);
    const [restoringCommitId, setRestoringCommitId] = useState(null);

    // Code execution state
    const [running, setRunning] = useState(false);
    const [executionOutput, setExecutionOutput] = useState(null);
    const [showOutput, setShowOutput] = useState(false);
    const outputRef = useRef(null);
    const [downloadingRepo, setDownloadingRepo] = useState(false);
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
                const [repo, fileData] = await Promise.all([
                    getRepositoryById(repoId),
                    getRepositoryFiles(repoId),
                ]);
                setRepository(repo);
                setFiles(fileData);
                setTree(buildFileTree(fileData));

                const firstFile = fileData.find(f => f.type === 'file');
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
    }, [repoId]);

    useEffect(() => {
        if (!repoId) return;
        getCommitHistory(repoId).then(setCommits).catch(() => { });
    }, [repoId]);

    useEffect(() => {
        setTree(buildFileTree(files));
    }, [files]);

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
        const name = newItemName.trim();
        if (!name) { setCreateError('Name is required.'); return; }

        const siblings = files.filter(f =>
            (f.parent_id || null) === (fileFormParentId || null) &&
            f.repository_id === repoId
        );
        if (siblings.some(f => f.name?.toLowerCase() === name.toLowerCase())) {
            setCreateError('An item with that name already exists here.');
            return;
        }

        setCreating(true);
        setCreateError('');
        try {
            let newItem;
            if (fileFormType === 'folder') {
                newItem = await createRepositoryFolder({
                    repoId,
                    name,
                    parentId: fileFormParentId,
                    createdBy: user?.id || null,
                });
            } else {
                newItem = await createRepositoryFile({
                    repoId,
                    name,
                    parentId: fileFormParentId,
                    createdBy: user?.id || null,
                });
            }
            setFiles(prev => [...prev, newItem]);
            if (fileFormType === 'file') {
                handleSelectFile(newItem.id);
                setTabContents(prev => ({ ...prev, [newItem.id]: '' }));
            }
            setFileFormOpen(false);
            setNewItemName('');
        } catch (e) {
            setCreateError(e.message || 'Failed to create.');
        }
        setCreating(false);
    };

    const handleRename = useCallback(async (fileId, newName) => {
        try {
            const updated = await renameRepositoryFile({ fileId, newName, actorId: user?.id || null });
            setFiles(prev => prev.map(f => f.id === updated.id ? updated : f));
            setOpenTabs(prev => prev.map(t => t.id === updated.id ? { ...t, name: updated.name } : t));
        } catch (e) {
            setError(e.message || 'Rename failed');
        }
    }, []);

    const handleDelete = useCallback(async (fileId) => {
        const file = files.find(f => f.id === fileId);
        if (!file) return;
        const confirmed = window.confirm(`Delete "${file.name}"? ${file.type === 'folder' ? 'This will also delete all files inside.' : ''}`);
        if (!confirmed) return;
        try {
            await deleteRepositoryFile({ fileId, actorId: user?.id || null });
            const idsToRemove = new Set();
            const collect = (id) => {
                idsToRemove.add(id);
                files.filter(f => f.parent_id === id).forEach(child => collect(child.id));
            };
            collect(fileId);
            setFiles(prev => prev.filter(f => !idsToRemove.has(f.id)));
            setOpenTabs(prev => prev.filter(t => !idsToRemove.has(t.id)));
            if (idsToRemove.has(activeTabId)) {
                setActiveTabId(openTabs.find(t => !idsToRemove.has(t.id))?.id || null);
            }
        } catch (e) {
            setError(e.message || 'Delete failed');
        }
    }, [files, activeTabId, openTabs]);

    const handleDownloadCurrentFile = () => {
        if (!activeTabId) return;
        const file = files.find(f => f.id === activeTabId);
        if (!file) return;
        setDownloadingFile(true);
        try {
            const blob = new Blob([tabContents[activeTabId] ?? ''], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name || 'file.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } finally {
            setDownloadingFile(false);
        }
    };

    const handleDownloadRepo = async () => {
        if (!repository || files.length === 0) return;
        setDownloadingRepo(true);
        try {
            const zip = new JSZip();
            const getPath = (fileId) => {
                const f = files.find(x => x.id === fileId);
                if (!f) return '';
                if (f.parent_id) return getPath(f.parent_id) + '/' + f.name;
                return f.name;
            };
            files.filter(f => f.type === 'file').forEach(f => {
                zip.file(getPath(f.id), f.content ?? '');
            });
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${repository.name || 'repository'}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            setError('Failed to create zip.');
        } finally {
            setDownloadingRepo(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-80px)] items-center justify-center text-xs text-text-dim">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    Loading editor…
                </div>
            </div>
        );
    }

    if (!repository) {
        return (
            <div className="flex h-[calc(100vh-80px)] items-center justify-center text-xs text-text-dim">
                Repository not found.
            </div>
        );
    }

    const activeFile = files.find(f => f.id === activeTabId);
    const activePath = activeFile ? pathMap.get(activeFile.id) : '';
    const currentContent = activeTabId ? (tabContents[activeTabId] ?? '') : '';
    const currentLanguage = activeFile ? detectLanguage(activeFile.name) : 'plaintext';

    return (
        <div className="flex h-[calc(100vh-80px)] flex-col gap-0">
            {/* Top toolbar */}
            <div className="flex items-center justify-between bg-surface border-b border-border-dim px-3 py-1.5 text-xs text-text-sub shrink-0">
                <div className="flex items-center gap-2">
                    <Link
                        to={`/app/workspace/${workspaceId}`}
                        className="rounded-md border border-border-dim bg-subtle px-2 py-1 text-[11px] text-text-main hover:border-border-strong hover:text-text-main transition"
                    >
                        ← Back
                    </Link>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-text-main">{repository.name}</span>
                        {repository.visibility && (
                            <span className={`text-[10px] ${repository.visibility === 'private' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {repository.visibility}
                            </span>
                        )}
                        {activePath && (
                            <span className="text-[10px] text-text-dim">{activePath}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {savedMessage && <span className="text-[11px] text-emerald-400">{savedMessage}</span>}
                    {error && <span className="text-[11px] text-rose-400 max-w-[200px] truncate">{error}</span>}
                    <button onClick={() => setCommitDialogOpen(true)} disabled={!canCommit} className="btn-editor" title={canCommit ? 'Commit changes' : 'No permission to commit'}>
                        <GitCommit size={13} /> Commit
                    </button>
                    <button onClick={() => setCommitsOpen(prev => !prev)} className="btn-editor" title="History">
                        <History size={13} /> {commits.length}
                    </button>
                    <button onClick={handleDownloadCurrentFile} disabled={!activeTabId || downloadingFile} className="btn-editor" title="Download file">
                        <Download size={13} />
                    </button>
                    <button onClick={handleDownloadRepo} disabled={downloadingRepo || files.length === 0} className="btn-editor" title="Download repo">
                        <FolderDown size={13} />
                    </button>
                    <button onClick={handleSave} disabled={!activeTabId || saving || !canEditFiles} className="btn-editor-primary" title={canEditFiles ? 'Save' : 'No permission to save'}>
                        {!canEditFiles ? <Lock size={13} /> : <Save size={13} />} {saving ? 'Saving…' : 'Save'}
                    </button>
                    <div className="w-px h-4 bg-subtle" />
                    <button
                        onClick={async () => {
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
                                    // ── Docker multi-file execution (Java / Python) ──
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
                                    // ── Judge0 single-file execution ──
                                    result = await executeCode({ code: currentContent, language: lang });
                                    result.command = `run ${file.name}`;
                                } else {
                                    result = { stdout: '', stderr: `Language not supported: ${lang}`, exitCode: 1, language: lang, version: '' };
                                }
                                setExecutionOutput(result);
                            } catch (err) {
                                setExecutionOutput({ stdout: '', stderr: err.message, exitCode: 1, language: lang, version: '', command: 'execution failed' });
                            }
                            setRunning(false);
                            setTimeout(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, 100);
                        }}
                        disabled={!activeTabId || running}
                        className="btn-editor-primary !bg-emerald-600 hover:!bg-emerald-500 disabled:!bg-emerald-800 disabled:!text-emerald-400"
                        title="Run code"
                    >
                        {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                        {running ? 'Running…' : 'Run'}
                    </button>
                </div>
            </div>

            {/* Commit dialog */}
            {commitDialogOpen && (
                <div className="bg-surface border-b border-border-dim px-4 py-3 shrink-0 animate-fade-in">
                    <form onSubmit={handleCommit} className="flex items-center gap-3">
                        <GitCommit size={16} className="text-brand-400 shrink-0" />
                        <input
                            autoFocus
                            value={commitMessage}
                            onChange={e => setCommitMessage(e.target.value)}
                            placeholder="Commit message (e.g. 'Add login component')"
                            className="flex-1 bg-canvas border border-border-dim rounded px-3 py-1.5 text-xs text-text-main outline-none focus:border-brand-500"
                        />
                        <button type="submit" disabled={committing || !commitMessage.trim()} className="btn-editor-primary">
                            {committing ? 'Committing…' : 'Commit All'}
                        </button>
                        <button type="button" onClick={() => setCommitDialogOpen(false)} className="btn-editor">
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            {/* Create file/folder form */}
            {fileFormOpen && (
                <div className="bg-surface border-b border-border-dim px-4 py-3 shrink-0 animate-fade-in">
                    <form onSubmit={handleCreateSubmit} className="flex items-center gap-3">
                        <span className="text-[11px] text-text-sub">New {fileFormType}:</span>
                        <input
                            autoFocus
                            value={newItemName}
                            onChange={e => setNewItemName(e.target.value)}
                            placeholder={fileFormType === 'folder' ? 'folder-name' : 'filename.ext'}
                            className="flex-1 bg-canvas border border-border-dim rounded px-3 py-1.5 text-xs text-text-main outline-none focus:border-brand-500 font-mono"
                        />
                        <button type="submit" disabled={creating || !newItemName.trim()} className="btn-editor-primary">
                            {creating ? 'Creating…' : 'Create'}
                        </button>
                        <button type="button" onClick={() => setFileFormOpen(false)} className="btn-editor">
                            Cancel
                        </button>
                    </form>
                    {createError && <p className="text-[11px] text-rose-400 mt-1 ml-14">{createError}</p>}
                </div>
            )}

            {/* Main content */}
            <div className="flex flex-1 min-h-0">
                {/* File tree */}
                <div className="w-60 shrink-0 border-r border-border-dim">
                    <FileTree
                        tree={tree}
                        currentFileId={activeTabId}
                        onSelectFile={handleSelectFile}
                        onCreateFile={handleCreateFile}
                        onCreateFolder={handleCreateFolder}
                        onRename={handleRename}
                        onDelete={handleDelete}
                    />
                </div>

                {/* Editor area */}
                <div className="flex flex-1 flex-col min-w-0">
                    {openTabs.length > 0 && (
                        <div className="flex bg-subtle border-b border-border-dim overflow-x-auto shrink-0 custom-scrollbar">
                            {openTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTabId(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] border-r border-border-dim shrink-0 transition-colors ${tab.id === activeTabId
                                        ? 'bg-canvas text-text-main border-b-2 border-b-accent'
                                        : 'text-text-sub hover:text-text-main hover:bg-subtle'
                                        }`}
                                >
                                    {dirtyTabs.has(tab.id) && (
                                        <Circle size={6} className="text-amber-400 fill-amber-400" />
                                    )}
                                    <span>{tab.name}</span>
                                    <span
                                        onClick={(e) => handleCloseTab(tab.id, e)}
                                        className="ml-1 p-0.5 rounded hover:bg-subtle text-text-dim hover:text-text-main"
                                    >
                                        <X size={10} />
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex-1 min-h-0 flex flex-col">
                        <div className={`${showOutput ? 'flex-1 min-h-0' : 'flex-1'}`} style={showOutput ? { flex: '1 1 60%' } : {}}>
                            {activeTabId ? (
                                <CodeEditor
                                    language={currentLanguage}
                                    value={currentContent}
                                    onChange={handleContentChange}
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center text-xs text-text-dim">
                                    <div className="text-center space-y-2">
                                        <p>Select a file to begin editing</p>
                                        <p className="text-[10px] text-text-dim">or create a new file with the + button</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Output Terminal Panel */}
                        {showOutput && (
                            <div className="border-t border-border-dim flex flex-col" style={{ flex: '0 0 40%', minHeight: '120px', maxHeight: '50%' }}>
                                <div className="flex items-center justify-between bg-surface px-3 py-1.5 border-b border-border-dim shrink-0">
                                    <div className="flex items-center gap-2 text-[11px]">
                                        <Terminal size={13} className="text-emerald-400" />
                                        <span className="font-medium text-text-main">Terminal</span>
                                        {executionOutput && !executionOutput.phase && (
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${executionOutput.exitCode === 0
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : 'bg-rose-500/10 text-rose-400'
                                                }`}>
                                                exit: {executionOutput.exitCode}
                                            </span>
                                        )}
                                        {executionOutput?.language && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-subtle text-text-sub">
                                                {executionOutput.language === 'Java' ? '☕' : executionOutput.language === 'Python' ? '🐍' : '▶'}{' '}
                                                {executionOutput.language} {executionOutput.version}
                                            </span>
                                        )}
                                        {executionOutput?.fileCount > 1 && (
                                            <span className="text-[9px] text-text-dim">
                                                {executionOutput.fileCount} files
                                            </span>
                                        )}
                                        {executionOutput?.executionTime != null && (
                                            <span className="text-[9px] text-text-dim">
                                                ⏱ {executionOutput.executionTime}ms
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setExecutionOutput(null)}
                                            className="text-text-dim hover:text-text-main p-1 rounded hover:bg-subtle text-[10px]"
                                            title="Clear output"
                                        >
                                            Clear
                                        </button>
                                        <button
                                            onClick={() => setShowOutput(false)}
                                            className="text-text-dim hover:text-text-main p-1 rounded hover:bg-subtle"
                                            title="Close panel"
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                </div>
                                <div
                                    ref={outputRef}
                                    className="flex-1 overflow-y-auto custom-scrollbar p-3 font-mono text-xs bg-[#0d1117]"
                                >
                                    {running && executionOutput?.phase === 'compiling' ? (
                                        <div className="space-y-2">
                                            <div className="text-text-dim text-[10px]">
                                                $ {executionOutput.command}
                                            </div>
                                            <div className="flex items-center gap-2 text-text-sub">
                                                <Loader2 size={14} className="animate-spin text-amber-400" />
                                                <span>{executionOutput.language === 'Java' ? 'Compiling' : 'Running'} {executionOutput.fileCount} file{executionOutput.fileCount !== 1 ? 's' : ''}…</span>
                                            </div>
                                        </div>
                                    ) : running ? (
                                        <div className="flex items-center gap-2 text-text-sub">
                                            <Loader2 size={14} className="animate-spin text-brand-400" />
                                            <span>Executing…</span>
                                        </div>
                                    ) : executionOutput && !executionOutput.phase ? (
                                        <div className="space-y-1">
                                            {/* Command line */}
                                            {executionOutput.command && (
                                                <div className="text-text-dim text-[10px] pb-1 border-b border-border-dim mb-2">
                                                    <span className="text-emerald-500">$</span> {executionOutput.command}
                                                </div>
                                            )}
                                            {/* Stdout */}
                                            {executionOutput.stdout && (
                                                <pre className="text-emerald-300 whitespace-pre-wrap break-words leading-relaxed">{executionOutput.stdout}</pre>
                                            )}
                                            {/* Stderr / compile errors */}
                                            {executionOutput.stderr && (
                                                <pre className="text-rose-400 whitespace-pre-wrap break-words leading-relaxed">{executionOutput.stderr}</pre>
                                            )}
                                            {!executionOutput.stdout && !executionOutput.stderr && (
                                                <span className="text-text-dim italic">Program exited with no output</span>
                                            )}
                                            {/* Return prompt */}
                                            <div className="text-text-dim text-[10px] pt-2 mt-2 border-t border-border-dim">
                                                <span className="text-emerald-600">$</span> _
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <span className="text-text-dim">Welcome to CollabSpace Terminal</span>
                                            <div className="text-text-dim text-[10px]">Click ▶ Run to execute the current project</div>
                                            <div className="text-text-dim text-[10px] mt-2">
                                                <span className="text-emerald-600">$</span> _
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* STDIN input area */}
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border-t border-border-dim shrink-0">
                                    <span className="text-[10px] text-text-dim shrink-0">stdin:</span>
                                    <input
                                        type="text"
                                        value={stdinValue}
                                        onChange={e => setStdinValue(e.target.value)}
                                        placeholder="Enter program input (optional)"
                                        className="flex-1 bg-canvas border border-border-dim rounded px-2 py-1 text-[11px] text-text-main font-mono outline-none focus:border-emerald-600 placeholder:text-text-dim"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Commit history sidebar */}
                {commitsOpen && (
                    <div className="w-80 shrink-0 border-l border-border-dim bg-surface flex flex-col">
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-dim">
                            <div className="flex items-center gap-2">
                                <History size={14} className="text-brand-400" />
                                <span className="text-[12px] font-semibold text-text-main">Commit History</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                                    {commits.length}
                                </span>
                            </div>
                            <button onClick={() => setCommitsOpen(false)} className="text-text-dim hover:text-text-main p-1 rounded hover:bg-subtle">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {commits.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                    <GitCommit size={28} className="text-text-dim mb-3" />
                                    <p className="text-[12px] text-text-dim">No commits yet</p>
                                    <p className="text-[10px] text-text-dim mt-1">Save your work to create the first commit</p>
                                </div>
                            ) : (
                                <div className="relative">
                                    {/* Timeline line */}
                                    <div className="absolute left-[19px] top-0 bottom-0 w-px bg-subtle" />

                                    {commits.map((c, idx) => {
                                        const isExpanded = expandedCommitId === c.id;
                                        const isRestoring = restoringCommitId === c.id;
                                        const fileCount = c.snapshot ? Object.keys(c.snapshot).length : 0;
                                        const isAutoSave = c.message?.startsWith('Auto save:');

                                        return (
                                            <div key={c.id} className="relative">
                                                {/* Timeline dot */}
                                                <div className="absolute left-[15px] top-[18px] z-10">
                                                    <div className={`w-[9px] h-[9px] rounded-full border-2 ${idx === 0
                                                        ? 'bg-brand-500 border-brand-400'
                                                        : isAutoSave
                                                            ? 'bg-subtle border-border-dim'
                                                            : 'bg-subtle border-border-dim'
                                                        }`} />
                                                </div>

                                                <div
                                                    className={`ml-10 mr-2 my-1 p-2.5 rounded-lg border transition-all cursor-pointer ${isExpanded
                                                        ? 'bg-surface border-brand-500/30'
                                                        : 'bg-subtle border-border-dim hover:border-border-dim hover:bg-subtle'
                                                        }`}
                                                    onClick={async () => {
                                                        if (isExpanded) {
                                                            setExpandedCommitId(null);
                                                            setCommitFilesList([]);
                                                            return;
                                                        }
                                                        setExpandedCommitId(c.id);
                                                        setCommitFilesLoading(true);
                                                        try {
                                                            const files = await getCommitFiles(c.id);
                                                            setCommitFilesList(files);
                                                        } catch {
                                                            setCommitFilesList([]);
                                                        }
                                                        setCommitFilesLoading(false);
                                                    }}
                                                >
                                                    {/* Commit header */}
                                                    <div className="flex items-start gap-2">
                                                        <ChevronRight
                                                            size={12}
                                                            className={`text-text-dim mt-0.5 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''
                                                                }`}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-[12px] leading-snug break-words ${isAutoSave ? 'text-text-sub italic' : 'text-text-main font-medium'
                                                                }`}>
                                                                {c.message}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                                {c.author_name && (
                                                                    <span className="flex items-center gap-1 text-[10px] text-text-dim">
                                                                        <User size={9} /> {c.author_name}
                                                                    </span>
                                                                )}
                                                                <span className="text-[10px] text-text-dim">
                                                                    {new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                {fileCount > 0 && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-subtle text-text-dim">
                                                                        {fileCount} file{fileCount !== 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Expanded: file list + restore */}
                                                    {isExpanded && (
                                                        <div className="mt-3 pt-2.5 border-t border-border-dim space-y-2 animate-fade-in" onClick={e => e.stopPropagation()}>
                                                            {/* Files in this commit */}
                                                            {commitFilesLoading ? (
                                                                <div className="flex items-center gap-2 text-[10px] text-text-dim py-1">
                                                                    <Loader2 size={10} className="animate-spin" /> Loading files…
                                                                </div>
                                                            ) : commitFilesList.length > 0 ? (
                                                                <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                                                    {commitFilesList.map(cf => (
                                                                        <div key={cf.id || cf.file_id} className="flex items-center gap-2 text-[10px] text-text-sub py-0.5 px-1 rounded hover:bg-subtle/50">
                                                                            <FileCode size={10} className="text-text-dim shrink-0" />
                                                                            <span className="truncate">{cf.file_path || cf.file_name}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-[10px] text-text-dim italic">No file details available</p>
                                                            )}

                                                            {/* Restore button */}
                                                            <button
                                                                disabled={isRestoring}
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    if (!window.confirm(`Restore all files to this commit?\n\n"${c.message}"\n\nThis will overwrite current file contents.`)) return;
                                                                    setRestoringCommitId(c.id);
                                                                    try {
                                                                        const updatedFiles = await restoreCommitSnapshot({
                                                                            commitId: c.id,
                                                                            repositoryId: repoId,
                                                                            actorId: user?.id || null,
                                                                        });
                                                                        // Refresh files state
                                                                        setFiles(prev => prev.map(f => {
                                                                            const updated = updatedFiles.find(u => u.id === f.id);
                                                                            return updated || f;
                                                                        }));
                                                                        // Clear tab contents so they reload from fresh data
                                                                        setTabContents(prev => {
                                                                            const next = { ...prev };
                                                                            updatedFiles.forEach(u => {
                                                                                if (next[u.id] !== undefined) {
                                                                                    next[u.id] = u.content ?? '';
                                                                                }
                                                                            });
                                                                            return next;
                                                                        });
                                                                        setDirtyTabs(new Set());
                                                                    } catch (err) {
                                                                        setError(err.message || 'Restore failed');
                                                                    }
                                                                    setRestoringCommitId(null);
                                                                }}
                                                                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/30 transition-colors disabled:opacity-50"
                                                            >
                                                                {isRestoring ? (
                                                                    <><Loader2 size={10} className="animate-spin" /> Restoring…</>
                                                                ) : (
                                                                    <><RotateCcw size={10} /> Restore this version</>
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
