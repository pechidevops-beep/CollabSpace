import React, { useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { Calendar, CheckCircle2, CircleDashed, AlertCircle } from 'lucide-react';

export default function AssignmentCard({ assignment, workspaceId, submission }) {
    const cardRef = useRef(null);
    const progressRef = useRef(null);

    // Determine progress from real submission
    let progress = 0;
    if (submission) {
        if (submission.grade !== null && submission.grade !== undefined) {
            progress = 100;
        } else {
            progress = 50; // submitted but not graded
        }
    }

    useLayoutEffect(() => {
        const el = cardRef.current;
        if (!el) return;

        const onMouseEnter = () => {
            gsap.to(el, {
                y: -5,
                borderColor: 'rgba(99, 102, 241, 0.4)',
                boxShadow: '0 10px 30px -10px rgba(99, 102, 241, 0.2)',
                duration: 0.3,
            });
            if (progressRef.current) {
                gsap.to(progressRef.current, {
                    width: `${progress}%`,
                    duration: 1,
                    ease: 'power2.out',
                });
            }
        };

        const onMouseLeave = () => {
            gsap.to(el, {
                y: 0,
                borderColor: 'rgba(255, 255, 255, 0.05)',
                boxShadow: 'none',
                duration: 0.3,
            });
        };

        el.addEventListener('mouseenter', onMouseEnter);
        el.addEventListener('mouseleave', onMouseLeave);

        return () => {
            el.removeEventListener('mouseenter', onMouseEnter);
            el.removeEventListener('mouseleave', onMouseLeave);
        };
    }, [progress]);

    // Status determination
    let StatusIcon = CircleDashed;
    let statusColor = 'text-slate-400';
    let statusBg = 'bg-slate-400/10';
    let statusText = 'Pending';

    if (progress === 100) {
        StatusIcon = CheckCircle2;
        statusColor = 'text-emerald-400';
        statusBg = 'bg-emerald-400/10';
        statusText = 'Graded';
    } else if (assignment.due_date && new Date(assignment.due_date) < new Date() && progress < 100) {
        StatusIcon = AlertCircle;
        statusColor = 'text-rose-400';
        statusBg = 'bg-rose-400/10';
        statusText = progress > 0 ? 'Late' : 'Overdue';
    } else if (progress > 0) {
        StatusIcon = CircleDashed;
        statusColor = 'text-blue-400';
        statusBg = 'bg-blue-400/10';
        statusText = 'Submitted';
    }

    return (
        <Link to={`/app/workspace/${workspaceId}/assessments/assignment/${assignment.id}`} className="block">
            <div
                ref={cardRef}
                className="glass-card p-5 rounded-xl border border-white/5 relative overflow-hidden group"
            >
                <div className="flex justify-between items-start mb-3">
                    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-medium border border-white/5 ${statusBg} ${statusColor}`}>
                        <StatusIcon size={12} />
                        <span>{statusText}</span>
                    </div>
                    {assignment.due_date && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <Calendar size={12} />
                            <span>Due {new Date(assignment.due_date).toLocaleDateString()}</span>
                        </div>
                    )}
                </div>

                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-brand-300 transition-colors">
                    {assignment.title}
                </h3>

                <p className="text-slate-400 text-xs mb-4 line-clamp-2">
                    {assignment.description || 'No instructions provided.'}
                </p>

                {/* Workspace name */}
                {assignment.workspaces?.name && (
                    <p className="text-[10px] text-slate-500 mb-3">
                        in {assignment.workspaces.name}
                    </p>
                )}

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        ref={progressRef}
                        className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-brand-500'} shadow-[0_0_10px_rgba(99,102,241,0.5)]`}
                        style={{ width: '0%' }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                    <span>Progress</span>
                    <span>{progress}%</span>
                </div>
            </div>
        </Link>
    );
}
