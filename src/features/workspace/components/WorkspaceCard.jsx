import React, { useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ArrowRight, GraduationCap, Users } from 'lucide-react';

export default function WorkspaceCard({ workspace, onDelete, isDeleting }) {
    const cardRef = useRef(null);

    useLayoutEffect(() => {
        const el = cardRef.current;
        if (!el) return;

        const ctx = gsap.context(() => {
            const onMouseEnter = () => {
                gsap.to(el, {
                    y: -5,
                    scale: 1.02,
                    boxShadow: '0 20px 40px -10px rgba(79, 70, 229, 0.3)',
                    borderColor: 'rgba(99, 102, 241, 0.5)',
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', // darker on hover
                    duration: 0.3,
                    ease: 'power2.out'
                });
            };

            const onMouseLeave = () => {
                gsap.to(el, {
                    y: 0,
                    scale: 1,
                    boxShadow: 'none',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    backgroundColor: '', // revert to class style
                    duration: 0.3,
                    ease: 'power2.out'
                });
            };

            el.addEventListener('mouseenter', onMouseEnter);
            el.addEventListener('mouseleave', onMouseLeave);

            return () => {
                el.removeEventListener('mouseenter', onMouseEnter);
                el.removeEventListener('mouseleave', onMouseLeave);
            };
        }, cardRef);

        return () => ctx.revert();
    }, []);

    const isClassroom = workspace.type === 'classroom';

    return (
        <div
            ref={cardRef}
            className="glass-card rounded-xl p-5 border border-white/10 relative group cursor-pointer bg-slate-900/80 backdrop-blur-xl hover:shadow-lg transition-all"
        >
            <Link to={`/app/workspace/${workspace.id}`} className="block h-full">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-2.5 rounded-lg ${isClassroom ? 'bg-orange-500/10 text-orange-400' : 'bg-brand-500/10 text-brand-400'}`}>
                        {isClassroom ? <GraduationCap size={20} /> : <Users size={20} />}
                    </div>
                    {workspace.role === 'owner' && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                onDelete(workspace);
                            }}
                            disabled={isDeleting}
                            className="text-xs text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded bg-slate-900/50 hover:bg-slate-800"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                    )}
                </div>

                <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-brand-300 transition-colors">
                    {workspace.name}
                </h3>

                <p className="text-slate-400 text-xs mb-6">
                    {isClassroom ? 'Assessments Environment' : 'Collaborative Team'} • {workspace.role}
                </p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
                    <span className="text-[10px] text-slate-500">
                        Joined {new Date(workspace.created_at).toLocaleDateString()}
                    </span>
                    <span className="p-1.5 rounded-full bg-white/5 text-white opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                        <ArrowRight size={14} />
                    </span>
                </div>
            </Link>
        </div>
    );
}
