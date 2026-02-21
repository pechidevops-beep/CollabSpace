import React, { useRef, useLayoutEffect, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { LayoutGrid, FolderGit2, Users } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getDashboardStats } from '../../../services/workspaceService';

export default function DashboardStats({ workspaces = [], loading = false }) {
    const containerRef = useRef(null);
    const { user } = useAuth();
    const totalWorkspaces = workspaces.length;

    const [totalRepos, setTotalRepos] = useState(0);
    const [activeMembers, setActiveMembers] = useState(0);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        if (!user) { setStatsLoading(false); return; }
        getDashboardStats(user.id)
            .then(({ totalRepos, totalMembers }) => {
                setTotalRepos(totalRepos);
                setActiveMembers(totalMembers);
            })
            .catch(() => { })
            .finally(() => setStatsLoading(false));
    }, [user?.id, workspaces.length]);

    const isLoading = loading || statsLoading;

    useLayoutEffect(() => {
        if (isLoading) return;

        const ctx = gsap.context(() => {
            gsap.from('.stat-card', {
                y: 20, opacity: 0, duration: 0.5,
                stagger: 0.1, ease: 'power2.out',
            });

            gsap.from('.stat-value', {
                textContent: 0, duration: 1.5,
                ease: 'power1.out', snap: { textContent: 1 },
                stagger: 0.15,
            });
        }, containerRef);
        return () => ctx.revert();
    }, [isLoading, totalWorkspaces, totalRepos, activeMembers]);

    const stats = [
        { label: 'Total Workspaces', value: totalWorkspaces, icon: LayoutGrid, color: 'text-blue-400' },
        { label: 'Repositories', value: totalRepos, icon: FolderGit2, color: 'text-purple-400' },
        { label: 'Active Members', value: activeMembers, icon: Users, color: 'text-emerald-400' },
    ];

    if (isLoading) return <div className="h-24 w-full animate-pulse rounded-xl bg-slate-900/50" />;

    return (
        <div ref={containerRef} className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
            {stats.map((stat, idx) => (
                <div
                    key={idx}
                    className="stat-card glass-card p-5 rounded-xl border border-white/10 relative overflow-hidden group bg-slate-900/80 backdrop-blur-xl"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                            <h3 className="text-3xl font-bold text-white mt-1 stat-value">{stat.value}</h3>
                        </div>
                        <div className={`p-3 rounded-lg bg-slate-800/50 ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                            <stat.icon size={24} />
                        </div>
                    </div>
                    <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${stat.color.replace('text-', 'bg-')}/10 blur-2xl rounded-full group-hover:bg-opacity-20 transition-all duration-500`} />
                </div>
            ))}
        </div>
    );
}
