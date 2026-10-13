import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import FileTree from '../../editor/components/FileTree';
import PageTransition from '../../../components/shared/PageTransition';
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
                setFiles(fileData);
                setTree(buildFileTree(fileData));
                setCommits(commitData);
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
            <div className="flex h-[70vh] items-center justify-center text-xs text-slate-500">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    Loading repository…
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-[70vh] items-center justify-center text-xs text-rose-400">
                {error}
            </div>
        );
    }

    if (!repository) {
        return (
            <div className="flex h-[70vh] items-center justify-center text-xs text-slate-500">
                Repository not found.
            </div>
        );
    }

    const fileCount = files.filter(f => f.type === 'file').length;
    const folderCount = files.filter(f => f.type === 'folder').length;

    return (
        <PageTransition>
            <div className="space-y-6 pb-8">
                <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                            <Code size={24} className="text-brand-400" />
                            {repository.name}
                        </h1>
                        {repository.description && (
                            <p className="mt-1 text-sm text-slate-400 max-w-xl">{repository.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-3">
                            <div className="flex items-center gap-1.5 text-[11px]">
                                {repository.visibility === 'private' ? (
                                    <><Lock size={12} className="text-amber-400" /><span className="text-amber-400">Private</span></>
                                ) : (
                                    <><Globe size={12} className="text-emerald-400" /><span className="text-emerald-400">Public</span></>
                                )}
                            </div>
                            {repository.language && (
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                    <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                                    {repository.language}
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                <Star size={12} className="text-yellow-400" />
                                {repository.stars_count ?? 0}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                <GitFork size={12} className="text-slate-300" />
                                {repository.forks_count ?? 0}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Calendar size={12} />
                                {new Date(repository.created_at).toLocaleDateString()}
                            </div>
                            <div className="text-[11px] text-slate-500">
                                Size: {formatBytes(repository.size_bytes ?? 0)}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate(`/app/workspace/${workspaceId}/editor/${repoId}`)}
                        className="btn btn-primary text-xs self-start"
                    >
                        <FileCode size={16} /> Open Editor
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-semibold text-slate-200">
                                Files
                                <span className="ml-2 text-[10px] text-slate-500 font-normal">
                                    {fileCount} files, {folderCount} folders
                                </span>
                            </h2>
                        </div>

                        {fileFormOpen && (
                            <form onSubmit={handleCreateSubmit} className="glass-panel p-3 rounded-lg mb-3 animate-fade-in flex items-center gap-3">
                                <span className="text-[11px] text-slate-400">New {fileFormType}:</span>
                                <input
                                    autoFocus
                                    value={newItemName}
                                    onChange={e => setNewItemName(e.target.value)}
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-brand-500"
                                    placeholder={fileFormType === 'folder' ? 'folder-name' : 'filename.ext'}
                                />
                                <button type="submit" disabled={creating} className="btn-editor-primary">{creating ? '...' : 'Create'}</button>
                                <button type="button" onClick={() => setFileFormOpen(false)} className="btn-editor">Cancel</button>
                                {createError && <span className="text-[11px] text-rose-400">{createError}</span>}
                            </form>
                        )}

                        <div className="h-[400px]">
                            <FileTree
                                tree={tree}
                                currentFileId={null}
                                onSelectFile={(id) => navigate(`/app/workspace/${workspaceId}/editor/${repoId}`)}
                                onCreateFile={handleCreateFile}
                                onCreateFolder={handleCreateFolder}
                                onRename={handleRename}
                                onDelete={handleDelete}
                            />
                        </div>

                        {readmeContent && (
                            <div className="glass-panel p-4 rounded-xl mt-4">
                                <h3 className="text-sm font-semibold text-slate-200 mb-3">README</h3>
                                <div className="markdown text-sm text-slate-200">
                                    <ReactMarkdown>{readmeContent}</ReactMarkdown>
                                </div>
                                <p className="mt-3 text-[11px] text-slate-500">
                                    Last updated: {readmeFile?.last_modified_at ? new Date(readmeFile.last_modified_at).toLocaleString() : 'Unknown'}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="glass-panel p-4 rounded-xl">
                            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                                <GitCommit size={14} className="text-brand-400" />
                                Recent Commits
                            </h3>
                            {commits.length === 0 ? (
                                <p className="text-[11px] text-slate-500">No commits yet. Open the editor to start coding.</p>
                            ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {commits.slice(0, 10).map(c => (
                                        <div key={c.id} className="p-2 rounded-lg bg-slate-900/40 border border-slate-800">
                                            <p className="text-[12px] text-slate-200 leading-snug">{c.message}</p>
                                            <p className="text-[10px] text-slate-500 mt-1">
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
