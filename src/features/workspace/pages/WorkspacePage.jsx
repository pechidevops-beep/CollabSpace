import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import RepositoryCard from '../components/RepositoryCard';
import PageTransition from '../../../components/shared/PageTransition';
import { createRepository, getRepositories } from '../../../services/repositoryService';
import {
    getWorkspaceById,
    getWorkspaceMembers,
    inviteWorkspaceMember,
    updateMemberRole,
    removeMember,
} from '../../../services/workspaceService';
import { usePermissions, AVAILABLE_ROLES } from '../../../hooks/usePermissions';
import { gsap } from 'gsap';
import {
    Plus, Users, Settings, BookOpen, Copy, Check,
    FolderGit2, X, UserPlus, Mail, Shield, Trash2,
} from 'lucide-react';

export default function WorkspacePage() {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const mainRef = useRef(null);

    const [workspace, setWorkspace] = useState(null);
    const [repositories, setRepositories] = useState([]);
    const [members, setMembers] = useState([]);
    const [currentRole, setCurrentRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Repo creation form
    const [repoFormOpen, setRepoFormOpen] = useState(false);
    const [repoName, setRepoName] = useState('');
    const [repoDesc, setRepoDesc] = useState('');
    const [repoVisibility, setRepoVisibility] = useState('public');
    const [repoLanguage, setRepoLanguage] = useState('');
    const [creatingRepo, setCreatingRepo] = useState(false);

    // Invite member
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);

    // Join code copy
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!workspaceId) { setLoading(false); return; }
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [wsData, repoData, memberData] = await Promise.all([
                    getWorkspaceById(workspaceId),
                    getRepositories(workspaceId),
                    getWorkspaceMembers(workspaceId),
                ]);

                setWorkspace(wsData);
                setRepositories(repoData ?? []);
                setMembers(memberData ?? []);
                const myRole = (memberData ?? []).find((m) => m.user_id === user?.id)?.role ?? null;
                setCurrentRole(myRole);
            } catch (e) {
                setError(e.message ?? 'Failed to load workspace');
            }
            setLoading(false);
        };
        load();
    }, [workspaceId, user?.id]);

    useEffect(() => {
        if (loading || !mainRef.current) return;
        const ctx = gsap.context(() => {
            gsap.from('.workspace-section', { y: 20, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' });
        }, mainRef);
        return () => ctx.revert();
    }, [loading]);

    const handleCreateRepo = async (e) => {
        e.preventDefault();
        if (!repoName.trim()) return;
        setCreatingRepo(true);
        try {
            if (!['owner', 'maintainer'].includes(currentRole)) {
                throw new Error('Only owners and maintainers can create repositories.');
            }

            const newRepo = await createRepository({
                workspaceId,
                name: repoName.trim(),
                description: repoDesc.trim() || null,
                visibility: repoVisibility,
                language: repoLanguage || null,
                createdBy: user?.id || null,
            });
            setRepositories(prev => [newRepo, ...prev]);
            setRepoFormOpen(false);
            setRepoName('');
            setRepoDesc('');
            setRepoVisibility('public');
            setRepoLanguage('');
        } catch (e) {
            setError(e.message);
        }
        setCreatingRepo(false);
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;
        setInviting(true);
        try {
            const newMember = await inviteWorkspaceMember({
                workspaceId,
                email: inviteEmail.trim(),
            });
            setMembers(prev => [...prev, newMember]);
            setInviteEmail('');
            setInviteOpen(false);
        } catch (e) {
            setError(e.message);
        }
        setInviting(false);
    };

    const handleCopyCode = () => {
        if (!workspace?.join_code) return;
        navigator.clipboard.writeText(workspace.join_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isOwner = workspace?.owner_id === user?.id;
    const canManage = ['owner', 'admin'].includes(currentRole);
    const canCreateRepo = ['owner', 'admin', 'contributor'].includes(currentRole);
    const isViewer = currentRole === 'viewer';

    if (loading) {
        return (
            <div className="flex h-[70vh] items-center justify-center text-sm text-slate-500">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    Loading workspace…
                </div>
            </div>
        );
    }

    if (!workspace) {
        return (
            <div className="flex h-[70vh] items-center justify-center text-sm text-slate-500">
                Workspace not found.
            </div>
        );
    }

    return (
        <PageTransition>
            <div ref={mainRef} className="space-y-8 pb-8">
                {/* Header */}
                <header className="workspace-section flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">{workspace.name}</h1>
                        <p className="text-sm text-slate-400 mt-1">
                            {workspace.type === 'personal' ? 'Personal workspace' : 'Team workspace'} ·{' '}
                            {members.length} member{members.length !== 1 ? 's' : ''} · {repositories.length} repo{repositories.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            to={`/app/workspace/${workspaceId}/assessments`}
                            className="btn btn-secondary text-xs"
                        >
                            <BookOpen size={14} /> Assessments
                        </Link>
                        {canCreateRepo && (
                            <button onClick={() => setRepoFormOpen(p => !p)} className="btn btn-primary text-xs">
                                <Plus size={16} /> New Repo
                            </button>
                        )}
                    </div>
                </header>

                {error && <div className="glass-panel text-rose-400 text-xs rounded-lg p-3">{error}</div>}

                {/* Join Code */}
                {workspace.join_code && (
                    <div className="workspace-section glass-panel p-4 rounded-xl flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-400 mb-1">Join Code</p>
                            <p className="text-lg font-mono font-bold text-white tracking-wider">{workspace.join_code}</p>
                        </div>
                        <button onClick={handleCopyCode} className="btn btn-secondary text-xs">
                            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                        </button>
                    </div>
                )}

                {/* Create Repo Form */}
                {repoFormOpen && (
                    <div className="workspace-section glass-panel p-5 rounded-xl space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-white">Create Repository</h2>
                            <button onClick={() => setRepoFormOpen(false)} className="text-slate-500 hover:text-slate-300">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateRepo} className="space-y-3">
                            <input
                                autoFocus
                                value={repoName}
                                onChange={e => setRepoName(e.target.value)}
                                placeholder="Repository name"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500"
                            />
                            <textarea
                                value={repoDesc}
                                onChange={e => setRepoDesc(e.target.value)}
                                placeholder="Description (optional)"
                                rows={2}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500 resize-none"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Visibility</label>
                                    <select
                                        value={repoVisibility}
                                        onChange={e => setRepoVisibility(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
                                    >
                                        <option value="public">Public</option>
                                        <option value="private">Private</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Language</label>
                                    <select
                                        value={repoLanguage}
                                        onChange={e => setRepoLanguage(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
                                    >
                                        <option value="">None</option>
                                        <option value="JavaScript">JavaScript</option>
                                        <option value="TypeScript">TypeScript</option>
                                        <option value="Python">Python</option>
                                        <option value="Java">Java</option>
                                        <option value="C++">C++</option>
                                        <option value="Go">Go</option>
                                        <option value="Rust">Rust</option>
                                        <option value="Ruby">Ruby</option>
                                        <option value="HTML/CSS">HTML/CSS</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button type="button" onClick={() => setRepoFormOpen(false)} className="btn btn-secondary text-xs">Cancel</button>
                                <button type="submit" disabled={creatingRepo || !repoName.trim()} className="btn btn-primary text-xs">
                                    {creatingRepo ? 'Creating…' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Repositories Grid */}
                <section className="workspace-section">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                            <FolderGit2 size={16} className="text-brand-400" />
                            Repositories ({repositories.length})
                        </h2>
                    </div>
                    {repositories.length === 0 ? (
                        <div className="glass-panel p-10 rounded-xl text-center text-sm text-slate-500">
                            No repositories yet. {isOwner ? 'Create one above to get started.' : ''}
                        </div>
                    ) : (
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                            {repositories.map(repo => (
                                <RepositoryCard key={repo.id} repo={repo} />
                            ))}
                        </div>
                    )}
                </section>

                {/* Members */}
                <section className="workspace-section">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                            <Users size={16} className="text-brand-400" />
                            Members ({members.length})
                        </h2>
                        {canManage && (
                            <button onClick={() => setInviteOpen(p => !p)} className="btn btn-secondary text-xs">
                                <UserPlus size={14} /> Invite
                            </button>
                        )}
                    </div>

                    {inviteOpen && (
                        <form onSubmit={handleInvite} className="glass-panel p-4 rounded-lg mb-4 flex items-center gap-3 animate-fade-in">
                            <Mail size={14} className="text-slate-400 shrink-0" />
                            <input
                                autoFocus
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                placeholder="Enter user email to invite"
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
                            />
                            <button type="submit" disabled={inviting || !inviteEmail.trim()} className="btn btn-primary text-xs">
                                {inviting ? 'Inviting…' : 'Invite'}
                            </button>
                            <button type="button" onClick={() => setInviteOpen(false)} className="btn btn-ghost text-xs">
                                <X size={14} />
                            </button>
                        </form>
                    )}

                    <div className="space-y-2.5">
                        {members.map(m => {
                            const isSelf = m.user_id === user?.id;
                            const isMemberOwner = m.role === 'owner';
                            const canChangeRole = canManage && !isMemberOwner && !isSelf;
                            const canRemove = canManage && !isMemberOwner && !isSelf;

                            const roleBadgeClass = {
                                owner: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                                admin: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                                contributor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                                viewer: 'text-slate-400 bg-slate-800/50 border-slate-700',
                            }[m.role] || 'text-slate-400 bg-slate-800/50 border-slate-700';

                            return (
                                <div key={m.id} className="glass-panel p-3 rounded-lg flex items-center justify-between group hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600/30 to-purple-600/30 flex items-center justify-center text-[11px] font-semibold text-white border border-white/10">
                                            {(m.profiles?.full_name || m.profiles?.email || '?')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-white">
                                                {m.profiles?.full_name || 'Unknown'}
                                                {isSelf && <span className="text-[10px] text-slate-500 ml-1">(you)</span>}
                                            </p>
                                            <p className="text-[10px] text-slate-500">{m.profiles?.email || ''}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {canChangeRole ? (
                                            <select
                                                value={m.role}
                                                onChange={async (e) => {
                                                    const newRole = e.target.value;
                                                    try {
                                                        await updateMemberRole({
                                                            workspaceId,
                                                            memberId: m.id,
                                                            newRole,
                                                            actorId: user?.id,
                                                        });
                                                        setMembers(prev => prev.map(x =>
                                                            x.id === m.id ? { ...x, role: newRole } : x
                                                        ));
                                                    } catch (err) {
                                                        setError(err.message);
                                                    }
                                                }}
                                                className="text-[10px] bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 outline-none focus:border-brand-500 cursor-pointer"
                                            >
                                                {AVAILABLE_ROLES.filter(r => r.value !== 'owner').map(r => (
                                                    <option key={r.value} value={r.value}>{r.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${roleBadgeClass}`}>
                                                {m.role}
                                            </span>
                                        )}
                                        {canRemove && (
                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm(`Remove ${m.profiles?.full_name || 'this member'} from the workspace?`)) return;
                                                    try {
                                                        await removeMember({ workspaceId, memberId: m.id, actorId: user?.id });
                                                        setMembers(prev => prev.filter(x => x.id !== m.id));
                                                    } catch (err) {
                                                        setError(err.message);
                                                    }
                                                }}
                                                className="p-1 rounded text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Remove member"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        </PageTransition>
    );
}
