import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import AssignmentCard from '../components/AssignmentCard';
import PageTransition from '../../../components/shared/PageTransition';
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
    const { user, profile } = useAuth();
    const { canCreateAssignment, canGradeSubmissions, loading: permLoading } = usePermissions(workspaceId);

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

    const [isOwner, setIsOwner] = useState(false);

    useEffect(() => {
        if (!workspaceId || !user) return;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [assignData, workspace] = await Promise.all([
                    getAssignments(workspaceId),
                    getWorkspaceById(workspaceId),
                ]);
                setIsOwner(workspace?.owner_id === user.id);
                setAssignments(assignData);

                // Fetch user's submission for each assignment
                const subMap = {};
                await Promise.all(
                    assignData.map(async (a) => {
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

    if (!workspaceId) {
        return (
            <PageTransition>
                <div className="space-y-6 pb-8">
                    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                                <BookOpen size={24} className="text-brand-400" />
                                Assessments
                            </h1>
                            <p className="text-sm text-slate-400 mt-1">
                                Select a workspace to view assignments.
                            </p>
                        </div>
                    </header>

                    <section className="glass-panel p-6 rounded-xl">
                        <h2 className="text-sm font-semibold text-slate-200">Your workspaces</h2>
                        {workspaceLoading && (
                            <p className="mt-2 text-xs text-slate-500">Loading workspaces...</p>
                        )}
                        {workspaceError && !workspaceLoading && (
                            <p className="mt-2 text-xs text-rose-400">{workspaceError}</p>
                        )}
                        {!workspaceLoading && !workspaceError && workspaceOptions.length === 0 && (
                            <p className="mt-2 text-xs text-slate-500">
                                You are not a member of any workspaces yet.
                            </p>
                        )}
                        {!workspaceLoading && !workspaceError && workspaceOptions.length > 0 && (
                            <ul className="mt-3 space-y-2 text-xs text-slate-300">
                                {workspaceOptions.map((ws) => (
                                    <li
                                        key={ws.id}
                                        className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 transition hover:border-brand-500/40 hover:bg-slate-900/90"
                                    >
                                        <div>
                                            <Link
                                                to={`/app/workspace/${ws.id}/assessments`}
                                                className="text-slate-100 hover:text-brand-300"
                                            >
                                                {ws.name}
                                            </Link>
                                            <div className="text-[11px] text-slate-500">
                                                {ws.type === 'classroom'
                                                    ? 'Assessments workspace'
                                                    : 'Team workspace'}
                                            </div>
                                        </div>
                                        <span className="text-[11px] uppercase tracking-wide text-slate-500">
                                            {ws.role}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </PageTransition>
        );
    }

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center text-sm text-slate-500">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    Loading assessments...
                </div>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="space-y-6 pb-8">
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                            <BookOpen size={24} className="text-brand-400" />
                            Assessments
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">
                            {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} total
                        </p>
                    </div>
                    {canCreateAssignment && (
                        <button
                            onClick={() => setFormOpen(prev => !prev)}
                            className="btn btn-primary text-xs self-start"
                        >
                            <Plus size={16} /> New Assignment
                        </button>
                    )}
                </header>

                {error && (
                    <div className="glass-panel text-rose-400 text-xs rounded-lg p-3">{error}</div>
                )}

                {formOpen && (
                    <form onSubmit={handleCreate} className="glass-panel p-5 rounded-xl space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-white">Create Assignment</h2>
                            <button type="button" onClick={() => setFormOpen(false)} className="text-slate-500 hover:text-slate-300">
                                <X size={16} />
                            </button>
                        </div>
                        <input
                            autoFocus
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Assignment title"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500"
                        />
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Instructions & description (optional)"
                            rows={3}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500 resize-none"
                        />
                        <div className="flex items-center gap-3">
                            <Calendar size={14} className="text-slate-400" />
                            <input
                                type="datetime-local"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setFormOpen(false)} className="btn btn-secondary text-xs">Cancel</button>
                            <button type="submit" disabled={creating || !title.trim()} className="btn btn-primary text-xs">
                                {creating ? 'Creating…' : 'Create'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Tabs */}
                <div className="flex items-center gap-1 border-b border-slate-800 -mb-2">
                    <button
                        onClick={() => setTab('active')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'active'
                            ? 'text-white border-brand-500'
                            : 'text-slate-500 border-transparent hover:text-slate-300'
                            }`}
                    >
                        Active <span className="ml-1 text-[10px] opacity-70">({active.length})</span>
                    </button>
                    <button
                        onClick={() => setTab('past')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'past'
                            ? 'text-white border-brand-500'
                            : 'text-slate-500 border-transparent hover:text-slate-300'
                            }`}
                    >
                        Past <span className="ml-1 text-[10px] opacity-70">({past.length})</span>
                    </button>
                </div>

                {/* Stat summary */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Active', value: active.length, color: 'text-emerald-400 bg-emerald-400/10' },
                        {
                            label: 'Completed',
                            value: Object.values(submissions).filter(s => s.grade !== null && s.grade !== undefined).length,
                            color: 'text-blue-400 bg-blue-400/10',
                        },
                        {
                            label: 'Pending',
                            value: assignments.length - Object.keys(submissions).length,
                            color: 'text-amber-400 bg-amber-400/10',
                        },
                    ].map((s, i) => (
                        <div key={i} className="glass-panel p-4 rounded-xl text-center">
                            <p className="text-2xl font-bold text-white">{s.value}</p>
                            <p className={`text-[11px] font-medium mt-1 ${s.color.split(' ')[0]}`}>{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Cards */}
                {displayed.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-sm">
                        No {tab} assignments.
                    </div>
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
        </PageTransition>
    );
}

