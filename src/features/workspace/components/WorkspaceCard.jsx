import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap, Users } from 'lucide-react';
import Badge from '../../../components/ui/Badge';

export default function WorkspaceCard({ workspace, onDelete, isDeleting }) {
    const isClassroom = workspace.type === 'classroom';

    return (
        <div className="p-4 rounded-[14px] bg-surface border border-border-dim hover:border-border-strong hover:bg-subtle shadow-subtle transition-all duration-150 relative group">
            <Link to={`/app/workspace/${workspace.id}`} className="block h-full flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-start mb-3.5">
                        <div className="p-2.5 rounded-[10px] bg-subtle border border-border-dim text-accent">
                            {isClassroom ? <GraduationCap size={18} /> : <Users size={18} />}
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={workspace.role === 'owner' ? 'accent' : 'default'} size="sm">
                                {workspace.role}
                            </Badge>
                            {workspace.role === 'owner' && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onDelete(workspace);
                                    }}
                                    disabled={isDeleting}
                                    className="text-[11px] text-text-dim hover:text-semantic-danger opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded-md hover:bg-semantic-danger/10"
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                </button>
                            )}
                        </div>
                    </div>

                    <h3 className="text-sm font-semibold text-text-main mb-1 group-hover:text-accent transition-colors line-clamp-1">
                        {workspace.name}
                    </h3>

                    <p className="text-text-sub text-xs mb-4">
                        {isClassroom ? 'Classroom Environment' : 'Collaborative Team'}
                    </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border-dim text-[11px] text-text-dim font-medium">
                    <span>
                        Joined {new Date(workspace.created_at).toLocaleDateString()}
                    </span>
                    <ArrowRight size={14} className="text-text-dim group-hover:text-text-main group-hover:translate-x-0.5 transition-all" />
                </div>
            </Link>
        </div>
    );
}
