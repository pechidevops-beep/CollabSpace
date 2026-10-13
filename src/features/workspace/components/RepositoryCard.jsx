import React from 'react';
import { Link } from 'react-router-dom';
import { FileCode, Calendar, FolderGit2, Globe, Lock } from 'lucide-react';
import Card from '../../../components/ui/Card';

export default function RepositoryCard({ repo }) {
    const isPrivate = repo.visibility === 'private';

    return (
        <Link to={`/app/workspace/${repo.workspace_id}/repo/${repo.id}`} className="block h-full group">
            <Card interactive={true} className="p-5 h-full flex flex-col justify-between">
                <div>
                    <div className="flex items-start justify-between mb-3.5">
                        <div className="p-2.5 bg-subtle border border-border-dim text-accent rounded-[10px] group-hover:border-border-strong transition-colors">
                            <FolderGit2 size={18} />
                        </div>
                        <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            isPrivate
                                ? 'text-semantic-warning bg-semantic-warning/10 border-semantic-warning/20'
                                : 'text-text-dim bg-subtle border-border-dim'
                        }`}>
                            {isPrivate ? <Lock size={10} /> : <Globe size={10} />}
                            <span>{isPrivate ? 'Private' : 'Public'}</span>
                        </div>
                    </div>

                    <h3 className="text-sm font-semibold text-text-main mb-1.5 group-hover:text-accent transition-colors line-clamp-1">
                        {repo.name}
                    </h3>

                    <p className="text-text-sub text-xs mb-4 line-clamp-2 leading-relaxed">
                        {repo.description || 'No description provided.'}
                    </p>
                </div>

                <div className="flex items-center gap-3.5 text-[11px] text-text-dim pt-3 border-t border-border-dim font-medium">
                    {repo.language && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-accent inline-block" />
                            <span>{repo.language}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1">
                        <FileCode size={12} />
                        <span>Source</span>
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                        <Calendar size={12} />
                        <span>{new Date(repo.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </Card>
        </Link>
    );
}
