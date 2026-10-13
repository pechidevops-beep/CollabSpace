import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import AssignmentCard from '../components/AssignmentCard';
import PageTransition from '../../../components/shared/PageTransition';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import EmptyState from '../../../components/ui/EmptyState';
import Skeleton from '../../../components/ui/Skeleton';
import Card from '../../../components/ui/Card';
import {
    createAssignment,
    getAssignments,
    getUserSubmission,
} from '../../../services/classroomService';
import { getWorkspaceById, getWorkspacesForUser } from '../../../services/workspaceService';
import {
    BookOpen, Plus, Calendar, X,
} from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';

export default function ClassroomPage() {
    const { workspaceId } = useParams();
    const { user } = useAuth();
    const { canCreateAssignment } = usePermissions(workspaceId);

    const [workspaceOptions, setWorkspaceOptions] = useState([]);
    const [workspaceLoading, setWorkspaceLoading] = useState(false);
    const [workspaceError, setWorkspaceError] = useState('');

    const [assignments, setAssignments] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [tab, setTab] = useState('active');
    const [formOpen, setFormOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!workspaceId || !user) return;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [assignData] = await Promise.all([
                    getAssignments(workspaceId),
                    getWorkspaceById(workspaceId),
                ]);
                setAssignments(assignData ?? []);

                // Fetch user's submission for each assignment
                const subMap = {};
                await Promise.all(
                    (assignData ?? []).map(async (a) => {
                        try {
                            const sub = await getUserSubmission(a.id, user.id);
                            if (sub) subMap[a.id] = sub;
                        } catch { }
                    })
                );
                setSubmissions(subMap);
            } catch (e) {
                setError(e.message || 'Failed to load assignments');
            }
            setLoading(false);
        };
        load();
    }, [workspaceId, user?.id]);

    useEffect(() => {
        if (workspaceId || !user) return;
        const loadWorkspaces = async () => {
            setWorkspaceLoading(true);
            setWorkspaceError('');
            try {
                const mapped = await getWorkspacesForUser(user.id);
                setWorkspaceOptions(mapped);
            } catch (err) {
                setWorkspaceError(err?.message || 'Failed to load workspaces.');
            }
            setWorkspaceLoading(false);
        };

        loadWorkspaces();
    }, [workspaceId, user?.id]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setCreating(true);
        try {
            const a = await createAssignment({
                workspaceId,
                title: title.trim(),
                description: description.trim(),
                dueDate: dueDate || null,
                createdBy: user.id,
            });
            setAssignments(prev => [a, ...prev]);
            setFormOpen(false);
            setTitle('');
            setDescription('');
            setDueDate('');
        } catch (e) {
            setError(e.message || 'Failed to create assignment');
        }
        setCreating(false);
    };

    const now = new Date();
    const active = assignments.filter(a => !a.due_date || new Date(a.due_date) >= now);
    const past = assignments.filter(a => a.due_date && new Date(a.due_date) < now);
    const displayed = tab === 'active' ? active : past;

    // View when no workspaceId in URL (global assessments index)
    if (!workspaceId) {
        return (
            <PageTransition>
                <div className="space-y-6 pb-8 animate-fade-up">
                    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-semibold text-text-main tracking-tight flex items-center gap-2.5">
                                <BookOpen size={22} className="text-accent" />
                                Assessments
                            </h1>
                            <p className="text-xs text-text-sub mt-1">
                                Select a workspace to view assignments.
                            </p>
                        </div>
                    </header>

                    <Card className="p-5">
                        <h2 className="text-sm font-semibold text-text-main">Your workspaces</h2>
                        {workspaceLoading && (
                            <p className="mt-2 text-xs text-text-sub">Loading workspaces...</p>
                        )}
                        {workspaceError && !workspaceLoading && (
                            <p className="mt-2 text-xs text-semantic-danger">{workspaceError}</p>
                        )}
                        {!workspaceLoading && !workspaceError && workspaceOptions.length === 0 && (
                            <p className="mt-2 text-xs text-text-sub">
                                You are not a member of any workspaces yet.
                            </p>
                        )}
                        {!workspaceLoading && !workspaceError && workspaceOptions.length > 0 && (
                            <ul className="mt-3 space-y-2 text-xs">
                                {workspaceOptions.map((ws) => (
                                    <li
                                        key={ws.id}
                                        className="flex items-center justify-between rounded-[10px] border border-border-dim bg-subtle px-3.5 py-2.5 transition hover:border-border-strong hover:bg-surface"
                                    >
                                        <div>
                                            <Link
                                                to={`/app/workspace/${ws.id}/assessments`}
                                                className="text-text-main font-medium hover:text-accent transition-colors"
                                            >
                                                {ws.name}
                                            </Link>
                                            <div className="text-[11px] text-text-dim mt-0.5">
                                                {ws.type === 'classroom'
                                                    ? 'Assessments workspace'
                                                    : 'Team workspace'}
                                            </div>
                                        </div>
                                        <span className="text-[11px] uppercase tracking-wide text-text-dim font-medium">
                                            {ws.role}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            </PageTransition>
        );
    }

    if (loading) {
        return (
            <div className="space-y-4 py-6">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-6 w-32 rounded-md" />
                    <Skeleton className="h-9 w-28 rounded-md" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                    <Skeleton className="h-44 rounded-2xl" />
                    <Skeleton className="h-44 rounded-2xl" />
                    <Skeleton className="h-44 rounded-2xl" />
                </div>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="space-y-6 pb-8 animate-fade-up">
                {/* Header: Note duplicate "Assessments" heading is removed. Only show action toolbar */}
                <header className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs text-text-sub">
                            {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} total
                        </p>
                    </div>
                    {canCreateAssignment && (
                        <Button
                            variant="primary"
                            size="sm"
                            icon={Plus}
                            onClick={() => setFormOpen(prev => !prev)}
                        >
                            New Assignment
                        </Button>
                    )}
                </header>

                {error && (
                    <div className="p-3.5 rounded-[10px] bg-semantic-danger/10 border border-semantic-danger/20 text-semantic-danger text-xs">
                        {error}
                    </div>
                )}

                {/* Create Assignment Form */}
                {formOpen && (
                    <Card className="p-5 animate-fade-in">
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-text-main">Create Assignment</h2>
                                <button
                                    type="button"
                                    onClick={() => setFormOpen(false)}
                                    className="text-text-dim hover:text-text-main p-1 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <Input
                                autoFocus
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Assignment title"
                                label="Title"
                                required
                            />
                            <div className="flex flex-col gap-1.5 w-full">
                                <label className="text-xs font-medium text-text-main">
                                    Instructions & Description
                                </label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Instructions & description (optional)"
                                    rows={3}
                                    className="w-full rounded-md bg-subtle border border-border-dim text-text-main text-xs p-3 transition-colors placeholder:text-text-dim focus:bg-surface focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 w-full">
                                <label className="text-xs font-medium text-text-main flex items-center gap-1.5">
                                    <Calendar size={13} className="text-text-dim" />
                                    <span>Due Date</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                    className="h-9 w-full sm:w-64 rounded-md bg-subtle border border-border-dim text-text-main text-xs px-3 transition-colors focus:bg-surface focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                                />
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setFormOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    loading={creating}
                                    disabled={creating || !title.trim()}
                                >
                                    {creating ? 'Creating…' : 'Create Assignment'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                )}

                {/* Stat summary */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Active', value: active.length, color: 'text-semantic-success' },
                        {
                            label: 'Completed',
                            value: Object.values(submissions).filter(s => s.grade !== null && s.grade !== undefined).length,
                            color: 'text-accent',
                        },
                        {
                            label: 'Pending',
                            value: assignments.length - Object.keys(submissions).length,
                            color: 'text-semantic-warning',
                        },
                    ].map((s, i) => (
                        <Card key={i} className="p-4 text-center">
                            <p className="text-2xl font-bold text-text-main tracking-tight leading-none">{s.value}</p>
                            <p className={`text-[11px] font-medium mt-1.5 ${s.color}`}>{s.label}</p>
                        </Card>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 border-b border-border-dim">
                    <button
                        onClick={() => setTab('active')}
                        className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${tab === 'active'
                            ? 'text-text-main border-accent'
                            : 'text-text-dim border-transparent hover:text-text-sub'
                            }`}
                    >
                        Active <span className="ml-1 text-[10px] opacity-75">({active.length})</span>
                    </button>
                    <button
                        onClick={() => setTab('past')}
                        className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${tab === 'past'
                            ? 'text-text-main border-accent'
                            : 'text-text-dim border-transparent hover:text-text-sub'
                            }`}
                    >
                        Past <span className="ml-1 text-[10px] opacity-75">({past.length})</span>
                    </button>
                </div>

                {/* Cards Container with strict 24px spacing (mt-6) from tabs */}
                <div className="mt-6">
                    {displayed.length === 0 ? (
                        <EmptyState
                            icon={BookOpen}
                            title={`No ${tab} assignments`}
                            description={
                                tab === 'active'
                                    ? 'No active assignments are currently due. Check past assignments or create a new one.'
                                    : 'No past assignments found for this workspace.'
                            }
                            actionLabel={canCreateAssignment && tab === 'active' ? 'New Assignment' : undefined}
                            actionIcon={Plus}
                            onAction={canCreateAssignment && tab === 'active' ? () => setFormOpen(true) : undefined}
                        />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {displayed.map(a => (
                                <AssignmentCard
                                    key={a.id}
                                    assignment={a}
                                    workspaceId={workspaceId}
                                    submission={submissions[a.id]}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageTransition>
    );
}
