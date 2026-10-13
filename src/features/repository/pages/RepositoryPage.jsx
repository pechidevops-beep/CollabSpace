import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import FileTree from '../../editor/components/FileTree';
import PageTransition from '../../../components/shared/PageTransition';
import Button from '../../../components/ui/Button';
import Skeleton from '../../../components/ui/Skeleton';
import ReactMarkdown from 'react-markdown';
import {
    createRepositoryFile,
    createRepositoryFolder,
    deleteRepositoryFile,
    getRepositoryById,
    getRepositoryFiles,
    renameRepositoryFile,
} from '../../../services/repositoryService';
import { getCommitHistory } from '../../../services/editorService';
import { buildFileTree } from '../../../utils/repository';
import {
    GitCommit, Code, Globe, Lock, Calendar, FileCode, Star, GitFork,
} from 'lucide-react';

const formatBytes = (value = 0) => {
    if (!value || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const idx = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const sized = value / 1024 ** idx;
    return `${sized.toFixed(sized >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

export default function RepositoryPage() {
    const { repoId, workspaceId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [repository, setRepository] = useState(null);
    const [files, setFiles] = useState([]);
    const [tree, setTree] = useState([]);
    const [commits, setCommits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // File creation
    const [fileFormOpen, setFileFormOpen] = useState(false);
    const [fileFormType, setFileFormType] = useState('file');
    const [fileFormParentId, setFileFormParentId] = useState(null);
    const [newItemName, setNewItemName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    useEffect(() => {
        if (!repoId) { setLoading(false); return; }
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [repo, fileData, commitData] = await Promise.all([
                    getRepositoryById(repoId),
                    getRepositoryFiles(repoId),
                    getCommitHistory(repoId),
                ]);
                setRepository(repo);
                setFiles(fileData ?? []);
                setTree(buildFileTree(fileData ?? []));
                setCommits(commitData ?? []);
            } catch (e) {
                setError(e.message || 'Failed to load repository');
            }
            setLoading(false);
        };
        load();
    }, [repoId]);

    useEffect(() => {
        setTree(buildFileTree(files));
    }, [files]);

    const readmeFile = useMemo(() => {
        const candidates = files.filter(f => f?.type === 'file' && typeof f?.name === 'string');
        const rootReadme = candidates.find(f => f.parent_id === null && f.name.toLowerCase() === 'readme.md');
        if (rootReadme) return rootReadme;
        return candidates.find(f => f.name.toLowerCase() === 'readme.md') || null;
    }, [files]);

    const readmeContent = (readmeFile?.content || '').trim();

    const handleCreateFile = (parentId) => {
        setFileFormParentId(parentId);
        setFileFormType('file');
        setFileFormOpen(true);
        setCreateError('');
        setNewItemName('');
    };

    const handleCreateFolder = (parentId) => {
        setFileFormParentId(parentId);
        setFileFormType('folder');
        setFileFormOpen(true);
        setCreateError('');
        setNewItemName('');
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        const name = newItemName.trim();
        if (!name) { setCreateError('Name required.'); return; }
        setCreating(true);
        try {
            const fn = fileFormType === 'folder' ? createRepositoryFolder : createRepositoryFile;
            const item = await fn({
                repoId,
                name,
                parentId: fileFormParentId,
                createdBy: user?.id || null,
            });
            setFiles(prev => [...prev, item]);
            setFileFormOpen(false);
            setNewItemName('');
        } catch (e) {
            setCreateError(e.message || 'Failed');
        }
        setCreating(false);
    };

    const handleRename = async (fileId, newName) => {
        try {
            const updated = await renameRepositoryFile({ fileId, newName, actorId: user?.id || null });
            setFiles(prev => prev.map(f => f.id === updated.id ? updated : f));
        } catch (e) {
            setError(e.message);
        }
    };

    const handleDelete = async (fileId) => {
        const file = files.find(f => f.id === fileId);
        if (!file || !window.confirm(`Delete "${file.name}"?`)) return;
        try {
            await deleteRepositoryFile({ fileId, actorId: user?.id || null });
            const idsToRemove = new Set();
            const collect = (id) => {
                idsToRemove.add(id);
                files.filter(f => f.parent_id === id).forEach(c => collect(c.id));
            };
            collect(fileId);
            setFiles(prev => prev.filter(f => !idsToRemove.has(f.id)));
        } catch (e) {
            setError(e.message);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6 py-4 animate-fade-up">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-8 w-48 rounded-md" />
                    <Skeleton className="h-9 w-28 rounded-md" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Skeleton className="h-96 rounded-[14px]" />
                    </div>
                    <div>
                        <Skeleton className="h-64 rounded-[14px]" />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 rounded-[10px] bg-semantic-danger/10 border border-semantic-danger/20 text-semantic-danger text-xs">
                {error}
            </div>
        );
    }

    if (!repository) {
        return (
            <div className="flex h-[60vh] items-center justify-center text-xs text-text-sub">
                Repository not found.
            </div>
        );
    }

    const fileCount = files.filter(f => f.type === 'file').length;
    const folderCount = files.filter(f => f.type === 'folder').length;

    return (
        <PageTransition>
            <div className="space-y-6 pb-8 animate-fade-up">
                <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold text-text-main tracking-tight flex items-center gap-2.5">
                            <Code size={22} className="text-accent" />
                            {repository.name}
                        </h1>
                        {repository.description && (
                            <p className="mt-1 text-xs text-text-sub max-w-xl">{repository.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3.5 mt-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium">
                                {repository.visibility === 'private' ? (
                                    <><Lock size={12} className="text-semantic-warning" /><span className="text-semantic-warning">Private</span></>
                                ) : (
                                    <><Globe size={12} className="text-semantic-success" /><span className="text-semantic-success">Public</span></>
                                )}
                            </div>
                            {repository.language && (
                                <div className="flex items-center gap-1.5 text-[11px] text-text-sub">
                                    <span className="w-2 h-2 rounded-full bg-accent inline-block" />
                                    <span>{repository.language}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 text-[11px] text-text-sub">
                                <Star size={12} className="text-amber-500" />
                                <span>{repository.stars_count ?? 0}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-text-sub">
                                <GitFork size={12} className="text-text-dim" />
                                <span>{repository.forks_count ?? 0}</span>
                            </div>
                            <div className="text-[11px] text-text-dim flex items-center gap-1">
                                <Calendar size={12} />
                                <span>{new Date(repository.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="text-[11px] text-text-dim">
                                Size: {formatBytes(repository.size_bytes ?? 0)}
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={FileCode}
                        onClick={() => navigate(`/app/workspace/${workspaceId}/editor/${repoId}`)}
                        className="self-start"
                    >
                        Open Editor
                    </Button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-semibold text-text-main uppercase tracking-wider">
                                Files
                                <span className="ml-2 text-[10px] text-text-dim font-normal normal-case">
                                    ({fileCount} files, {folderCount} folders)
                                </span>
                            </h2>
                        </div>

                        {fileFormOpen && (
                            <form onSubmit={handleCreateSubmit} className="p-3 rounded-[10px] bg-surface border border-border-dim shadow-subtle mb-3 animate-fade-in flex items-center gap-3">
                                <span className="text-xs text-text-sub">New {fileFormType}:</span>
                                <input
                                    autoFocus
                                    value={newItemName}
                                    onChange={e => setNewItemName(e.target.value)}
                                    className="flex-1 bg-subtle border border-border-dim rounded-md px-2.5 py-1 text-xs text-text-main outline-none focus:border-brand"
                                    placeholder={fileFormType === 'folder' ? 'folder-name' : 'filename.ext'}
                                />
                                <Button type="submit" variant="primary" size="sm" loading={creating}>
                                    {creating ? '...' : 'Create'}
                                </Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setFileFormOpen(false)}>
                                    Cancel
                                </Button>
                                {createError && <span className="text-xs text-semantic-danger">{createError}</span>}
                            </form>
                        )}

                        <div className="h-[400px] rounded-[14px] overflow-hidden border border-border-dim bg-surface shadow-subtle">
                            <FileTree
                                tree={tree}
                                currentFileId={null}
                                onSelectFile={() => navigate(`/app/workspace/${workspaceId}/editor/${repoId}`)}
                                onCreateFile={handleCreateFile}
                                onCreateFolder={handleCreateFolder}
                                onRename={handleRename}
                                onDelete={handleDelete}
                            />
                        </div>

                        {readmeContent && (
                            <div className="p-5 rounded-[14px] bg-surface border border-border-dim shadow-subtle">
                                <h3 className="text-xs font-semibold text-text-main uppercase tracking-wider mb-3">README.md</h3>
                                <div className="text-xs text-text-sub leading-relaxed prose-invert">
                                    <ReactMarkdown>{readmeContent}</ReactMarkdown>
                                </div>
                                <p className="mt-4 pt-3 border-t border-border-dim text-[11px] text-text-dim">
                                    Last updated: {readmeFile?.last_modified_at ? new Date(readmeFile.last_modified_at).toLocaleString() : 'Unknown'}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 rounded-[14px] bg-surface border border-border-dim shadow-subtle">
                            <h3 className="text-xs font-semibold text-text-main uppercase tracking-wider mb-3 flex items-center gap-2">
                                <GitCommit size={14} className="text-accent" />
                                Recent Commits
                            </h3>
                            {commits.length === 0 ? (
                                <p className="text-xs text-text-dim">No commits yet. Open the editor to start coding.</p>
                            ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {commits.slice(0, 10).map(c => (
                                        <div key={c.id} className="p-2.5 rounded-[10px] bg-subtle border border-border-dim">
                                            <p className="text-xs text-text-main leading-snug font-medium">{c.message}</p>
                                            <p className="text-[10px] text-text-dim mt-1">
                                                {new Date(c.created_at).toLocaleDateString()} • {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
}
