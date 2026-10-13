import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, CircleDashed, AlertCircle } from 'lucide-react';

export default function AssignmentCard({ assignment, workspaceId, submission }) {
    // Determine progress from real submission
    let progress = 0;
    if (submission) {
        if (submission.grade !== null && submission.grade !== undefined) {
            progress = 100;
        } else {
            progress = 50; // submitted but not graded
        }
    }

    // Status determination
    let StatusIcon = CircleDashed;
    let statusColor = 'text-text-dim';
    let statusBg = 'bg-subtle';
    let statusBorder = 'border-border-dim';
    let statusText = 'Pending';

    if (progress === 100) {
        StatusIcon = CheckCircle2;
        statusColor = 'text-semantic-success';
        statusBg = 'bg-semantic-success/10';
        statusBorder = 'border-semantic-success/20';
        statusText = 'Graded';
    } else if (assignment.due_date && new Date(assignment.due_date) < new Date() && progress < 100) {
        StatusIcon = AlertCircle;
        statusColor = 'text-semantic-danger';
        statusBg = 'bg-semantic-danger/10';
        statusBorder = 'border-semantic-danger/20';
        statusText = progress > 0 ? 'Late' : 'Overdue';
    } else if (progress > 0) {
        StatusIcon = CircleDashed;
        statusColor = 'text-accent';
        statusBg = 'bg-accent/10';
        statusBorder = 'border-accent/20';
        statusText = 'Submitted';
    }

    return (
        <Link to={`/app/workspace/${workspaceId}/assessments/assignment/${assignment.id}`} className="block group">
            <div className="p-4 rounded-[14px] bg-surface border border-border-dim hover:border-border-strong hover:bg-subtle shadow-subtle transition-all duration-150 flex flex-col justify-between h-full">
                <div>
                    <div className="flex justify-between items-start mb-3">
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusBg} ${statusColor} ${statusBorder}`}>
                            <StatusIcon size={12} />
                            <span>{statusText}</span>
                        </div>
                        {assignment.due_date && (
                            <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
                                <Calendar size={12} />
                                <span>Due {new Date(assignment.due_date).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>

                    <h3 className="text-sm font-semibold text-text-main mb-1.5 group-hover:text-accent transition-colors line-clamp-1">
                        {assignment.title}
                    </h3>

                    <p className="text-text-sub text-xs mb-4 line-clamp-2 leading-relaxed">
                        {assignment.description || 'No instructions provided.'}
                    </p>
                </div>

                <div>
                    {assignment.workspaces?.name && (
                        <p className="text-[11px] text-text-dim mb-2.5">
                            in {assignment.workspaces.name}
                        </p>
                    )}

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-subtle border border-border-dim rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${
                                progress === 100 ? 'bg-semantic-success' : 'bg-brand'
                            }`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[11px] text-text-dim font-medium">
                        <span>Progress</span>
                        <span>{progress}%</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
