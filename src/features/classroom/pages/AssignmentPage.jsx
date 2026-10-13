import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import PageTransition from '../../../components/shared/PageTransition';
import Button from '../../../components/ui/Button';
import Skeleton from '../../../components/ui/Skeleton';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
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
    CheckCircle2, Clock, AlertCircle, RotateCcw,
} from 'lucide-react';

const STATUS_CONFIG = {
    pending: { label: 'Pending', color: 'text-text-dim', bg: 'bg-black/5 dark:bg-white/6', border: 'border-border-subtle' },
    submitted: { label: 'Submitted', color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20' },
    reviewed: { label: 'Reviewed', color: 'text-semantic-success', bg: 'bg-semantic-success/10', border: 'border-semantic-success/20' },
    returned: { label: 'Returned', color: 'text-semantic-warning', bg: 'bg-semantic-warning/10', border: 'border-semantic-warning/20' },
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
            <div className="max-w-4xl mx-auto space-y-4 py-4 animate-fade-up">
                <Skeleton className="h-6 w-36 rounded-md" />
                <Skeleton className="h-44 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
        );
    }

    if (!assignment) {
        return (
            <div className="flex h-[60vh] items-center justify-center text-xs text-text-sub">
                Assignment not found.
            </div>
        );
    }

    // Stats
    const gradedCount = submissions.filter(s => s.grade != null).length;
    const avgGrade = gradedCount > 0
        ? (submissions.filter(s => s.grade != null).reduce((acc, s) => acc + Number(s.grade), 0) / gradedCount).toFixed(1)
        : 'N/A';

    return (
        <PageTransition>
            <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-fade-up">
                <Link
                    to={`/app/workspace/${workspaceId}/assessments`}
                    className="inline-flex items-center gap-2 text-xs text-text-sub hover:text-text-main transition-colors"
                >
                    <ArrowLeft size={14} /> Back to Assessments
                </Link>

                {error && (
                    <div className="p-3.5 rounded-[10px] bg-semantic-danger/10 border border-semantic-danger/20 text-semantic-danger text-xs">
                        {error}
                    </div>
                )}

                {/* Assignment details */}
                <Card className="p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h1 className="text-xl font-semibold text-text-main tracking-tight">{assignment.title}</h1>
                            <span className="text-[11px] text-text-dim mt-1 inline-block">Max points: {maxPts}</span>
                        </div>
                        {isPastDue ? (
                            <div className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-semantic-danger/10 text-semantic-danger border border-semantic-danger/20 font-medium">
                                <AlertCircle size={11} /> Past Due
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-semantic-success/10 text-semantic-success border border-semantic-success/20 font-medium">
                                <Clock size={11} /> Active
                            </div>
                        )}
                    </div>
                    {assignment.description && (
                        <p className="text-xs text-text-sub mb-4 whitespace-pre-wrap leading-relaxed">{assignment.description}</p>
                    )}
                    {assignment.due_date && (
                        <div className="flex items-center gap-2 text-xs text-text-dim">
                            <Calendar size={13} />
                            Due: {new Date(assignment.due_date).toLocaleString()}
                        </div>
                    )}
                </Card>

                {/* Student View */}
                {!canGradeSubmissions && (
                    <div className="space-y-4">
                        {mySubmission ? (
                            <Card className="p-5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-semantic-success" />
                                    <span className="text-xs font-semibold text-text-main">Submitted</span>
                                    <StatusBadge status={mySubmission.status || 'submitted'} />
                                </div>
                                <p className="text-xs text-text-dim">
                                    Submitted on {new Date(mySubmission.submitted_at).toLocaleString()}
                                </p>
                                {mySubmission.grade !== null && mySubmission.grade !== undefined && (
                                    <div className="mt-2 p-3.5 bg-subtle rounded-[10px] border border-border-subtle">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Star size={14} className="text-amber-500" />
                                            <span className="text-xs font-semibold text-text-main">Grade: {mySubmission.grade}/{maxPts}</span>
                                        </div>
                                        {mySubmission.feedback && (
                                            <p className="text-xs text-text-sub mt-2 leading-relaxed">{mySubmission.feedback}</p>
                                        )}
                                    </div>
                                )}
                                {mySubmission.status === 'returned' && (
                                    <div className="p-3 rounded-[10px] bg-semantic-warning/10 border border-semantic-warning/20 text-xs text-semantic-warning">
                                        <RotateCcw size={12} className="inline mr-1" /> Your submission was returned for revision. Please resubmit.
                                    </div>
                                )}
                                {(!isPastDue || mySubmission.status === 'returned') && (
                                    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-3">
                                        <input
                                            value={repoLink}
                                            onChange={e => setRepoLink(e.target.value)}
                                            placeholder="Update: paste repo ID or link"
                                            className="flex-1 bg-subtle border border-border-subtle rounded-md px-3 py-2 text-xs text-text-main outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                                        />
                                        <Button type="submit" variant="secondary" size="sm" icon={Send} disabled={submitting || !repoLink.trim()}>
                                            Re-submit
                                        </Button>
                                    </form>
                                )}
                            </Card>
                        ) : (
                            <Card className="p-5 space-y-3">
                                <form onSubmit={handleSubmit} className="space-y-3">
                                    <h3 className="text-sm font-semibold text-text-main">Submit Your Work</h3>
                                    <p className="text-xs text-text-sub">Paste a repository ID or link below.</p>
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={repoLink}
                                            onChange={e => setRepoLink(e.target.value)}
                                            placeholder="Repository ID or link"
                                            className="flex-1 bg-subtle border border-border-subtle rounded-md px-3 py-2 text-xs text-text-main outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                                            disabled={isPastDue}
                                        />
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            size="sm"
                                            icon={Send}
                                            loading={submitting}
                                            disabled={submitting || !repoLink.trim() || isPastDue}
                                        >
                                            {submitting ? 'Submitting…' : 'Submit'}
                                        </Button>
                                    </div>
                                    {isPastDue && (
                                        <p className="text-[11px] text-semantic-danger font-medium">This assignment is past due and can no longer be submitted.</p>
                                    )}
                                </form>
                            </Card>
                        )}
                    </div>
                )}

                {/* Teacher/Grader View */}
                {canGradeSubmissions && (
                    <div className="space-y-4">
                        {/* Stats bar */}
                        <div className="grid grid-cols-3 gap-3">
                            <Card className="p-3.5 text-center">
                                <p className="text-xl font-bold text-text-main tracking-tight">{submissions.length}</p>
                                <p className="text-[11px] text-text-dim mt-0.5">Submissions</p>
                            </Card>
                            <Card className="p-3.5 text-center">
                                <p className="text-xl font-bold text-semantic-success tracking-tight">{gradedCount}</p>
                                <p className="text-[11px] text-text-dim mt-0.5">Graded</p>
                            </Card>
                            <Card className="p-3.5 text-center">
                                <p className="text-xl font-bold text-accent tracking-tight">{avgGrade}</p>
                                <p className="text-[11px] text-text-dim mt-0.5">Avg Grade</p>
                            </Card>
                        </div>

                        <h2 className="text-sm font-semibold text-text-main">
                            Submissions ({submissions.length})
                        </h2>
                        {submissions.length === 0 ? (
                            <EmptyState
                                title="No submissions yet"
                                description="Students have not submitted their work for this assignment yet."
                            />
                        ) : (
                            <div className="space-y-3">
                                {submissions.map(s => (
                                    <Card key={s.id} className="p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/6 flex items-center justify-center text-[11px] font-semibold text-text-main">
                                                    {(s.student_name || '?')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-text-main">
                                                        {s.student_name || s.student_id}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[11px] text-text-dim">
                                                            {new Date(s.submitted_at).toLocaleString()}
                                                        </p>
                                                        <StatusBadge status={s.status || 'submitted'} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {s.grade !== null && s.grade !== undefined ? (
                                                    <div className="flex items-center gap-1 text-xs text-semantic-success font-semibold">
                                                        <Star size={13} />
                                                        {s.grade}/{maxPts}
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => { setGradingId(gradingId === s.id ? null : s.id); setGradeVal(''); setFeedbackVal(''); }}
                                                    >
                                                        Grade
                                                    </Button>
                                                )}
                                                {s.status !== 'returned' && s.grade == null && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleReturn(s.id)}
                                                        className="p-1.5 rounded-md text-semantic-warning hover:bg-semantic-warning/10 transition-colors"
                                                        title="Return for revision"
                                                    >
                                                        <RotateCcw size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {s.repository_id && (
                                            <p className="text-[11px] text-text-dim mb-2 font-mono">Repo: {s.repository_id}</p>
                                        )}
                                        {s.feedback && (
                                            <p className="text-xs text-text-sub bg-subtle p-2.5 rounded-md mt-1 leading-relaxed">{s.feedback}</p>
                                        )}
                                        {gradingId === s.id && (
                                            <div className="mt-3 p-3.5 bg-subtle rounded-[10px] border border-border-subtle space-y-2.5 animate-fade-in">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-xs text-text-main w-16">Grade</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={maxPts}
                                                        value={gradeVal}
                                                        onChange={e => setGradeVal(e.target.value)}
                                                        className="w-24 bg-surface border border-border-subtle rounded-md px-2 py-1 text-xs text-text-main outline-none focus:border-brand"
                                                        placeholder={`0-${maxPts}`}
                                                    />
                                                    <span className="text-[11px] text-text-dim">/ {maxPts}</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <label className="text-xs text-text-main w-16 pt-1">Feedback</label>
                                                    <textarea
                                                        value={feedbackVal}
                                                        onChange={e => setFeedbackVal(e.target.value)}
                                                        rows={2}
                                                        className="flex-1 bg-surface border border-border-subtle rounded-md px-2 py-1.5 text-xs text-text-main outline-none focus:border-brand resize-none"
                                                        placeholder="Optional feedback…"
                                                    />
                                                </div>
                                                <div className="flex gap-2 justify-end pt-1">
                                                    <Button variant="ghost" size="sm" onClick={() => setGradingId(null)}>
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        icon={MessageSquare}
                                                        onClick={() => handleGrade(s.id)}
                                                        loading={grading}
                                                        disabled={grading || !gradeVal}
                                                    >
                                                        {grading ? 'Saving…' : 'Save Grade'}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </PageTransition>
    );
}
