import React, { useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { FileCode, Calendar, FolderGit2, Globe, Lock } from 'lucide-react';

export default function RepositoryCard({ repo }) {
    const cardRef = useRef(null);

    useLayoutEffect(() => {
        const el = cardRef.current;
        if (!el) return;

        const onMouseMove = (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const xPct = x / rect.width - 0.5;
            const yPct = y / rect.height - 0.5;

            gsap.to(el, {
                rotateY: xPct * 10,
                rotateX: -yPct * 10,
                transformPerspective: 1000,
                duration: 0.5,
                ease: 'power2.out',
            });
        };

        const onMouseLeave = () => {
            gsap.to(el, {
                rotateY: 0,
                rotateX: 0,
                duration: 0.5,
                ease: 'power2.out',
            });
        };

        el.addEventListener('mousemove', onMouseMove);
        el.addEventListener('mouseleave', onMouseLeave);

        return () => {
            el.removeEventListener('mousemove', onMouseMove);
            el.removeEventListener('mouseleave', onMouseLeave);
        };
    }, []);

    const isPrivate = repo.visibility === 'private';

    return (
        <Link to={`/app/workspace/${repo.workspace_id}/repo/${repo.id}`} className="block h-full">
            <div
                ref={cardRef}
                className="glass-card group p-5 rounded-xl border border-white/5 h-full flex flex-col transition-shadow hover:shadow-neon"
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-brand-500/10 text-brand-400 rounded-lg group-hover:bg-brand-500/20 transition-colors">
                        <FolderGit2 size={24} />
                    </div>
                    <div className={`text-[10px] px-2 py-1 rounded border flex items-center gap-1 ${isPrivate
                        ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                        : 'text-slate-500 bg-slate-900/50 border-slate-800'
                        }`}>
                        {isPrivate ? <Lock size={10} /> : <Globe size={10} />}
                        {isPrivate ? 'Private' : 'Public'}
                    </div>
                </div>

                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-brand-300 transition-colors">
                    {repo.name}
                </h3>

                <p className="text-slate-400 text-xs mb-6 flex-1 line-clamp-2">
                    {repo.description || 'No description provided.'}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-500 pt-4 border-t border-white/5">
                    {repo.language && (
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                            <span>{repo.language}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <FileCode size={14} />
                        <span>Source</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        <span>{new Date(repo.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
