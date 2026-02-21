import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useParams } from 'react-router-dom';
import { getWorkspaceById, getWorkspaceMembers } from '../../../services/workspaceService';
import { useAuth } from '../../../context/AuthContext';
import { LayoutGrid, BookOpen, Loader2 } from 'lucide-react';

export default function WorkspaceLayout() {
    const { workspaceId } = useParams();
    const { user } = useAuth();
    const [workspace, setWorkspace] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!workspaceId) return;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const ws = await getWorkspaceById(workspaceId);
                setWorkspace(ws);
            } catch (e) {
                setError(e.message || 'Failed to load workspace');
            }
            setLoading(false);
        };
        load();
    }, [workspaceId]);

    if (loading) {
        return (
            <div className="flex h-[70vh] items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                    <Loader2 size={24} className="animate-spin text-brand-500" />
                    <span className="text-sm">Loading workspace…</span>
                </div>
            </div>
        );
    }

    if (error || !workspace) {
        return (
            <div className="flex h-[70vh] items-center justify-center">
                <div className="text-center">
                    <p className="text-sm text-rose-400 mb-2">{error || 'Workspace not found.'}</p>
                    <a href="/app/dashboard" className="text-xs text-brand-400 hover:underline">← Back to Dashboard</a>
                </div>
            </div>
        );
    }

    const tabs = [
        { to: `/app/workspace/${workspaceId}`, label: 'Overview', icon: LayoutGrid, end: true },
        { to: `/app/workspace/${workspaceId}/assessments`, label: 'Assessments', icon: BookOpen, end: false },
    ];

    return (
        <div className="space-y-0">
            {/* Workspace Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white tracking-tight">{workspace.name}</h1>
                <p className="text-sm text-slate-400 mt-1">
                    {workspace.type === 'classroom' ? 'Assessments' : 'Team'} workspace
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 border-b border-slate-800 mb-6">
                {tabs.map((tab) => (
                    <NavLink
                        key={tab.to}
                        to={tab.to}
                        end={tab.end}
                        className={({ isActive }) =>
                            `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${isActive
                                ? 'text-white border-brand-500'
                                : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-700'
                            }`
                        }
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </NavLink>
                ))}
            </div>

            {/* Child route content */}
            <Outlet />
        </div>
    );
}
