import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import RepositoryCard from '../components/RepositoryCard';
import PageTransition from '../../../components/shared/PageTransition';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import EmptyState from '../../../components/ui/EmptyState';
import Skeleton from '../../../components/ui/Skeleton';
import Card, { CardRow } from '../../../components/ui/Card';
import { createRepository, getRepositories } from '../../../services/repositoryService';
import {
    getWorkspaceById,
    getWorkspaceMembers,
    inviteWorkspaceMember,
    updateMemberRole,
    removeMember,
} from '../../../services/workspaceService';
import { AVAILABLE_ROLES } from '../../../hooks/usePermissions';
import {
    Plus, Users, BookOpen, Copy, Check,
    FolderGit2, X, UserPlus, Mail, Trash2,
} from 'lucide-react';

export default function WorkspacePage() {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

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

    if (loading) {
        return (
            <div className="space-y-6 py-4 animate-fade-up">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-8 w-48 rounded-md" />
                    <Skeleton className="h-9 w-28 rounded-md" />
                </div>
                <Skeleton className="h-24 w-full rounded-[16px]" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Skeleton className="h-36 rounded-[16px]" />
                    <Skeleton className="h-36 rounded-[16px]" />
                    <Skeleton className="h-36 rounded-[16px]" />
                </div>
            </div>
        );
    }

    if (!workspace) {
        return (
            <div className="flex h-[60vh] items-center justify-center text-xs text-text-sub">
                Workspace not found.
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="space-y-8 pb-8 animate-fade-up">
                {/* Action Bar (Header is owned by WorkspaceLayout) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-xs text-text-sub font-medium">
                        {members.length} member{members.length !== 1 ? 's' : ''} · {repositories.length} repo{repositories.length !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center gap-2">
                        {canCreateRepo && (
                            <Button
                                variant="primary"
                                size="sm"
                                icon={Plus}
                                onClick={() => setRepoFormOpen(p => !p)}
                            >
                                New Repo
                            </Button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="p-3.5 rounded-[10px] bg-semantic-danger/10 border border-semantic-danger/20 text-semantic-danger text-xs">
                        {error}
                    </div>
                )}

                {/* Join Code */}
                {workspace.join_code && (
                    <Card className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-medium text-text-sub uppercase tracking-wider mb-1">
                                Join Code
                            </p>
                            <p className="text-base sm:text-lg font-mono font-bold text-text-main tracking-wider">
                                {workspace.join_code}
                            </p>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={copied ? Check : Copy}
                            onClick={handleCopyCode}
                        >
                            {copied ? 'Copied' : 'Copy'}
                        </Button>
                    </Card>
                )}

                {/* Create Repo Form */}
                {repoFormOpen && (
                    <Card className="p-6 space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-text-main">Create Repository</h2>
                            <button
                                type="button"
                                onClick={() => setRepoFormOpen(false)}
                                className="text-text-dim hover:text-text-main p-1 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateRepo} className="space-y-3">
                            <Input
                                autoFocus
                                value={repoName}
                                onChange={e => setRepoName(e.target.value)}
                                placeholder="Repository name"
                                label="Repository Name"
                                required
                            />
                            <div className="flex flex-col gap-1.5 w-full">
                                <label className="text-xs font-medium text-text-main">Description (optional)</label>
                                <textarea
                                    value={repoDesc}
                                    onChange={e => setRepoDesc(e.target.value)}
                                    placeholder="Brief description of this repository"
                                    rows={2}
                                    className="w-full rounded-md bg-subtle border border-border-subtle text-text-main text-xs p-3 transition-colors placeholder:text-text-dim focus:bg-surface focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-text-main">Visibility</label>
                                    <select
                                        value={repoVisibility}
                                        onChange={e => setRepoVisibility(e.target.value)}
                                        className="h-9 w-full rounded-md bg-subtle border border-border-subtle text-text-main text-xs px-3 transition-colors focus:bg-surface focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                                    >
                                        <option value="public">Public</option>
                                        <option value="private">Private</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-text-main">Language</label>
                                    <select
                                        value={repoLanguage}
                                        onChange={e => setRepoLanguage(e.target.value)}
                                        className="h-9 w-full rounded-md bg-subtle border border-border-subtle text-text-main text-xs px-3 transition-colors focus:bg-surface focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
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
                            <div className="flex gap-2 justify-end pt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setRepoFormOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    loading={creatingRepo}
                                    disabled={creatingRepo || !repoName.trim()}
                                >
                                    {creatingRepo ? 'Creating…' : 'Create'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                )}

                {/* Repositories Grid */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-text-main flex items-center gap-2">
                            <FolderGit2 size={16} className="text-accent" />
                            Repositories ({repositories.length})
                        </h2>
                    </div>
                    {repositories.length === 0 ? (
                        <EmptyState
                            icon={FolderGit2}
                            title="No repositories yet"
                            description={isOwner ? "Create a repository to store code and collaborate." : "No repositories have been created in this workspace yet."}
                            actionLabel={canCreateRepo ? "Create Repository" : undefined}
                            actionIcon={Plus}
                            onAction={canCreateRepo ? () => setRepoFormOpen(true) : undefined}
                        />
                    ) : (
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                            {repositories.map(repo => (
                                <RepositoryCard key={repo.id} repo={repo} />
                            ))}
                        </div>
                    )}
                </section>

                {/* Members */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-text-main flex items-center gap-2">
                            <Users size={16} className="text-accent" />
                            Members ({members.length})
                        </h2>
                        {canManage && (
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={UserPlus}
                                onClick={() => setInviteOpen(p => !p)}
                            >
                                Invite
                            </Button>
                        )}
                    </div>

                    {inviteOpen && (
                        <Card className="p-4 mb-4 animate-fade-in">
                            <form onSubmit={handleInvite} className="flex items-center gap-3">
                                <Mail size={15} className="text-text-dim shrink-0" />
                                <input
                                    autoFocus
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    placeholder="Enter user email to invite"
                                    className="flex-1 bg-subtle border border-border-subtle rounded-md px-3 py-2 text-xs text-text-main outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                                />
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    loading={inviting}
                                    disabled={inviting || !inviteEmail.trim()}
                                >
                                    {inviting ? 'Inviting…' : 'Invite'}
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => setInviteOpen(false)}
                                    className="text-text-dim hover:text-text-main p-1 transition-colors"
                                >
                                    <X size={15} />
                                </button>
                            </form>
                        </Card>
                    )}

                    <div className="space-y-2">
                        {members.map(m => {
                            const isSelf = m.user_id === user?.id;
                            const isMemberOwner = m.role === 'owner';
                            const canChangeRole = canManage && !isMemberOwner && !isSelf;
                            const canRemove = canManage && !isMemberOwner && !isSelf;

                            const roleBadgeClass = {
                                owner: 'text-semantic-warning bg-semantic-warning/10 border-semantic-warning/20',
                                admin: 'text-accent bg-accent/10 border-accent/20',
                                contributor: 'text-text-main bg-black/5 dark:bg-white/6 border-border-subtle',
                                viewer: 'text-text-dim bg-black/5 dark:bg-white/6 border-border-subtle',
                            }[m.role] || 'text-text-dim bg-black/5 dark:bg-white/6 border-border-subtle';

                            return (
                                <CardRow key={m.id} className="p-3.5 group hover:border-border-strong">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/6 flex items-center justify-center text-[11px] font-semibold text-text-main">
                                            {(m.profiles?.full_name || m.profiles?.email || '?')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-text-main">
                                                {m.profiles?.full_name || 'Unknown'}
                                                {isSelf && <span className="text-[10px] text-text-dim ml-1">(you)</span>}
                                            </p>
                                            <p className="text-[11px] text-text-dim">{m.profiles?.email || ''}</p>
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
                                                className="text-[11px] bg-subtle border border-border-subtle rounded-md px-2 py-1 text-text-main outline-none focus:border-brand cursor-pointer"
                                            >
                                                {AVAILABLE_ROLES.filter(r => r.value !== 'owner').map(r => (
                                                    <option key={r.value} value={r.value}>{r.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${roleBadgeClass}`}>
                                                {m.role}
                                            </span>
                                        )}
                                        {canRemove && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!window.confirm(`Remove ${m.profiles?.full_name || 'this member'} from the workspace?`)) return;
                                                    try {
                                                        await removeMember({ workspaceId, memberId: m.id, actorId: user?.id });
                                                        setMembers(prev => prev.filter(x => x.id !== m.id));
                                                    } catch (err) {
                                                        setError(err.message);
                                                    }
                                                }}
                                                className="p-1.5 rounded-md text-text-dim hover:text-semantic-danger hover:bg-semantic-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Remove member"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                </CardRow>
                            );
                        })}
                    </div>
                </section>
            </div>
        </PageTransition>
    );
}
