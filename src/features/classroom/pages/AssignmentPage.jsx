import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import PageTransition from '../../../components/shared/PageTransition';
import {
    getAssignmentById,
    getSubmissionsWithProfiles,
    getUserSubmission,
    submitWork,
    gradeSubmission,
    updateSubmissionStatus,
} from '../../../services/classroomService';
import { usePermissions } from '../../../hooks/usePermissions';
import {
    ArrowLeft, Calendar, Send, Star, MessageSquare,
    CheckCircle2, Clock, AlertCircle, RotateCcw, Eye,
} from 'lucide-react';

const STATUS_CONFIG = {
    pending: { label: 'Pending', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
    submitted: { label: 'Submitted', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    reviewed: { label: 'Reviewed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    returned: { label: 'Returned', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.color} ${cfg.bg} ${cfg.border}`}>
            {cfg.label}
        </span>
    );
}

export default function AssignmentPage() {
    const { assignmentId, workspaceId } = useParams();
    const { user } = useAuth();
    const { canGradeSubmissions, loading: permLoading } = usePermissions(workspaceId);

    const [assignment, setAssignment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Student
    const [mySubmission, setMySubmission] = useState(null);
    const [repoLink, setRepoLink] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Teacher
    const [submissions, setSubmissions] = useState([]);
    const [gradingId, setGradingId] = useState(null);
    const [gradeVal, setGradeVal] = useState('');
    const [feedbackVal, setFeedbackVal] = useState('');
    const [grading, setGrading] = useState(false);

    useEffect(() => {
        if (!assignmentId || !user || permLoading) { if (!permLoading) setLoading(false); return; }
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const assignmentRow = await getAssignmentById(assignmentId);
                setAssignment(assignmentRow);

                if (canGradeSubmissions) {
                    const subs = await getSubmissionsWithProfiles(assignmentId);
                    setSubmissions(subs);
                } else {
                    const sub = await getUserSubmission(assignmentId, user.id);
                    setMySubmission(sub);
                }
            } catch (e) {
                setError(e.message || 'Failed to load');
            }
            setLoading(false);
        };
        load();
    }, [assignmentId, user?.id, workspaceId, canGradeSubmissions, permLoading]);

    const isPastDue = assignment?.due_date && new Date(assignment.due_date) < new Date();
    const maxPts = assignment?.max_points ?? 100;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!repoLink.trim()) return;
        setSubmitting(true);
        try {
            const sub = await submitWork({
                assignmentId,
                studentId: user.id,
                repositoryId: repoLink.trim(),
            });
            setMySubmission(sub);
            setRepoLink('');
        } catch (e) {
            setError(e.message);
        }
        setSubmitting(false);
    };

    const handleGrade = async (subId) => {
        if (!gradeVal) return;
        setGrading(true);
        try {
            const updated = await gradeSubmission({
                submissionId: subId,
                grade: Number(gradeVal),
                feedback: feedbackVal.trim() || null,
                graderId: user.id,
            });
            setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, ...updated } : s));
            setGradingId(null);
            setGradeVal('');
            setFeedbackVal('');
        } catch (e) {
            setError(e.message);
        }
        setGrading(false);
    };

    const handleReturn = async (subId) => {
        try {
            const updated = await updateSubmissionStatus({ submissionId: subId, status: 'returned' });
            setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, ...updated } : s));
        } catch (e) {
            setError(e.message);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center text-sm text-slate-500">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    Loading assignment…
                </div>
            </div>
        );
    }

    if (!assignment) {
        return (
            <div className="flex h-[60vh] items-center justify-center text-sm text-slate-500">
                Assignment not found.
            </div>
        );
    }

    // Stats
    const gradedCount = submissions.filter(s => s.grade != null).length;
    const avgGrade = gradedCount > 0
        ? (submissions.filter(s => s.grade != null).reduce((acc, s) => acc + Number(s.grade), 0) / gradedCount).toFixed(1)
        : '—';

    return (
        <PageTransition>
            <div className="max-w-4xl mx-auto space-y-6 pb-8">
                <Link
                    to={`/app/workspace/${workspaceId}/assessments`}
                    className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                    <ArrowLeft size={14} /> Back to Assessments
                </Link>

                {error && (
                    <div className="glass-panel text-rose-400 text-xs rounded-lg p-3">{error}</div>
                )}

                {/* Assignment details */}
                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h1 className="text-xl font-bold text-white">{assignment.title}</h1>
                            <span className="text-[10px] text-slate-500 mt-1">Max points: {maxPts}</span>
                        </div>
                        {isPastDue ? (
                            <div className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <AlertCircle size={10} /> Past Due
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Clock size={10} /> Active
                            </div>
                        )}
                    </div>
                    {assignment.description && (
                        <p className="text-sm text-slate-300 mb-4 whitespace-pre-wrap">{assignment.description}</p>
                    )}
                    {assignment.due_date && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Calendar size={14} />
                            Due: {new Date(assignment.due_date).toLocaleString()}
                        </div>
                    )}
                </div>

                {/* ─── Student View ─── */}
                {!canGradeSubmissions && (
                    <div className="space-y-4">
                        {mySubmission ? (
                            <div className="glass-panel p-5 rounded-xl space-y-3">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-400" />
                                    <span className="text-sm font-medium text-white">Submitted</span>
                                    <StatusBadge status={mySubmission.status || 'submitted'} />
                                </div>
                                <p className="text-xs text-slate-400">
                                    Submitted on {new Date(mySubmission.submitted_at).toLocaleString()}
                                </p>
                                {mySubmission.grade !== null && mySubmission.grade !== undefined && (
                                    <div className="mt-2 p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Star size={14} className="text-amber-400" />
                                            <span className="text-sm font-semibold text-white">Grade: {mySubmission.grade}/{maxPts}</span>
                                        </div>
                                        {mySubmission.feedback && (
                                            <p className="text-xs text-slate-300 mt-2">{mySubmission.feedback}</p>
                                        )}
                                    </div>
                                )}
                                {mySubmission.status === 'returned' && (
                                    <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400">
                                        <RotateCcw size={11} className="inline mr-1" /> Your submission was returned for revision. Please resubmit.
                                    </div>
                                )}
                                {(!isPastDue || mySubmission.status === 'returned') && (
                                    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-3">
                                        <input
                                            value={repoLink}
                                            onChange={e => setRepoLink(e.target.value)}
                                            placeholder="Update: paste repo ID or link"
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
                                        />
                                        <button type="submit" disabled={submitting || !repoLink.trim()} className="btn btn-secondary text-xs">
                                            <Send size={14} /> Re-submit
                                        </button>
                                    </form>
                                )}
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="glass-panel p-5 rounded-xl space-y-3">
                                <h3 className="text-sm font-semibold text-white">Submit Your Work</h3>
                                <p className="text-xs text-slate-400">Paste a repository ID or link below.</p>
                                <div className="flex items-center gap-2">
                                    <input
                                        value={repoLink}
                                        onChange={e => setRepoLink(e.target.value)}
                                        placeholder="Repository ID or link"
                                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
                                        disabled={isPastDue}
                                    />
                                    <button
                                        type="submit"
                                        disabled={submitting || !repoLink.trim() || isPastDue}
                                        className="btn btn-primary text-xs"
                                    >
                                        <Send size={14} /> {submitting ? 'Submitting…' : 'Submit'}
                                    </button>
                                </div>
                                {isPastDue && (
                                    <p className="text-[11px] text-rose-400">This assignment is past due and can no longer be submitted.</p>
                                )}
                            </form>
                        )}
                    </div>
                )}

                {/* ─── Teacher/Grader View ─── */}
                {canGradeSubmissions && (
                    <div className="space-y-4">
                        {/* Stats bar */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="glass-panel p-3 rounded-lg text-center">
                                <p className="text-lg font-bold text-white">{submissions.length}</p>
                                <p className="text-[10px] text-slate-500">Submissions</p>
                            </div>
                            <div className="glass-panel p-3 rounded-lg text-center">
                                <p className="text-lg font-bold text-emerald-400">{gradedCount}</p>
                                <p className="text-[10px] text-slate-500">Graded</p>
                            </div>
                            <div className="glass-panel p-3 rounded-lg text-center">
                                <p className="text-lg font-bold text-amber-400">{avgGrade}</p>
                                <p className="text-[10px] text-slate-500">Avg Grade</p>
                            </div>
                        </div>

                        <h2 className="text-sm font-semibold text-slate-200">
                            Submissions ({submissions.length})
                        </h2>
                        {submissions.length === 0 ? (
                            <div className="glass-panel p-6 rounded-xl text-center text-sm text-slate-500">
                                No submissions yet.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {submissions.map(s => (
                                    <div key={s.id} className="glass-panel p-4 rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-600/30 to-purple-600/30 flex items-center justify-center text-[10px] font-semibold text-white border border-white/10">
                                                    {(s.student_name || '?')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">
                                                        {s.student_name || s.student_id}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[10px] text-slate-500">
                                                            {new Date(s.submitted_at).toLocaleString()}
                                                        </p>
                                                        <StatusBadge status={s.status || 'submitted'} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {s.grade !== null && s.grade !== undefined ? (
                                                    <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                                                        <Star size={12} />
                                                        {s.grade}/{maxPts}
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => { setGradingId(gradingId === s.id ? null : s.id); setGradeVal(''); setFeedbackVal(''); }}
                                                        className="btn btn-secondary text-[11px]"
                                                    >
                                                        Grade
                                                    </button>
                                                )}
                                                {s.status !== 'returned' && s.grade == null && (
                                                    <button
                                                        onClick={() => handleReturn(s.id)}
                                                        className="btn btn-ghost text-[11px] text-amber-400 hover:bg-amber-500/10"
                                                        title="Return for revision"
                                                    >
                                                        <RotateCcw size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {s.repository_id && (
                                            <p className="text-[11px] text-slate-400 mb-2">Repo: {s.repository_id}</p>
                                        )}
                                        {s.feedback && (
                                            <p className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded mt-1">{s.feedback}</p>
                                        )}
                                        {gradingId === s.id && (
                                            <div className="mt-3 p-3 bg-slate-900/80 rounded-lg border border-slate-700 space-y-2 animate-fade-in">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-slate-300 w-16">Grade</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={maxPts}
                                                        value={gradeVal}
                                                        onChange={e => setGradeVal(e.target.value)}
                                                        className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-brand-500"
                                                        placeholder={`0-${maxPts}`}
                                                    />
                                                    <span className="text-[10px] text-slate-500">/ {maxPts}</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <label className="text-[11px] text-slate-300 w-16 pt-1">Feedback</label>
                                                    <textarea
                                                        value={feedbackVal}
                                                        onChange={e => setFeedbackVal(e.target.value)}
                                                        rows={2}
                                                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-brand-500 resize-none"
                                                        placeholder="Optional feedback…"
                                                    />
                                                </div>
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => setGradingId(null)} className="btn btn-ghost text-[11px]">Cancel</button>
                                                    <button
                                                        onClick={() => handleGrade(s.id)}
                                                        disabled={grading || !gradeVal}
                                                        className="btn btn-primary text-[11px]"
                                                    >
                                                        <MessageSquare size={12} /> {grading ? 'Saving…' : 'Save Grade'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </PageTransition>
    );
}
