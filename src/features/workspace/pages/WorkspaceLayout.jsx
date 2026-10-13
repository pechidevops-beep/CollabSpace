import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useParams, Link, useLocation } from 'react-router-dom';
import { getWorkspaceById } from '../../../services/workspaceService';
import { LayoutGrid, BookOpen } from 'lucide-react';
import Skeleton from '../../../components/ui/Skeleton';

export default function WorkspaceLayout() {
    const { workspaceId } = useParams();
    const location = useLocation();
    const [workspace, setWorkspace] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const isEditor = location.pathname.includes('/editor/');

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

    // Focus mode: Hide workspace header/tabs completely on editor route
    if (isEditor) {
        return <Outlet />;
    }

    if (loading) {
        return (
            <div className="space-y-4 py-4 animate-fade-up">
                <Skeleton className="h-8 w-64 rounded-md" />
                <Skeleton className="h-4 w-40 rounded-md" />
                <div className="flex gap-4 border-b border-border-dim pt-4 pb-2">
                    <Skeleton className="h-6 w-24 rounded-md" />
                    <Skeleton className="h-6 w-24 rounded-md" />
                </div>
            </div>
        );
    }

    if (error || !workspace) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="text-center p-6 rounded-[16px] bg-surface border border-border-dim max-w-sm">
                    <p className="text-xs text-semantic-danger mb-3">{error || 'Workspace not found.'}</p>
                    <Link to="/app/dashboard" className="text-xs text-accent hover:underline font-medium">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const tabs = [
        { to: `/app/workspace/${workspaceId}`, label: 'Overview', icon: LayoutGrid, end: true },
        { to: `/app/workspace/${workspaceId}/assessments`, label: 'Assessments', icon: BookOpen, end: false },
    ];

    return (
        <div className="space-y-0 animate-fade-up">
            {/* Single Workspace Header */}
            <header className="mb-6">
                <h1 className="text-xl sm:text-2xl font-semibold text-text-main tracking-tight">{workspace.name}</h1>
                <p className="text-xs text-text-sub mt-1">
                    {workspace.type === 'classroom' ? 'Assessments' : 'Team'} workspace
                </p>
            </header>

            {/* Tab Navigation with strict 24px (mb-6) spacing below */}
            <nav className="flex items-center gap-1 border-b border-border-dim mb-6" aria-label="Workspace tabs">
                {tabs.map((tab) => (
                    <NavLink
                        key={tab.to}
                        to={tab.to}
                        end={tab.end}
                        className={({ isActive }) =>
                            `flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${isActive
                                ? 'text-text-main border-accent'
                                : 'text-text-dim border-transparent hover:text-text-sub'
                            }`
                        }
                    >
                        <tab.icon size={15} />
                        {tab.label}
                    </NavLink>
                ))}
            </nav>

            {/* Child route content */}
            <Outlet />
        </div>
    );
}
