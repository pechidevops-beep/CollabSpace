import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { getWorkspacesForUser } from '../../../services/workspaceService';
import WorkspaceCard from '../components/WorkspaceCard';
import Skeleton from '../../../components/ui/Skeleton';
import EmptyState from '../../../components/ui/EmptyState';
import { Building2 } from 'lucide-react';

export default function WorkspacesPage() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    const fetchWorkspaces = async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await getWorkspacesForUser(user.id);
        setWorkspaces(rows);
      } catch (err) {
        setError(err?.message ?? 'Failed to load workspaces');
      }
      setLoading(false);
    };

    fetchWorkspaces();
  }, [user?.id]);

  return (
    <div className="space-y-6 animate-fade-up pb-8">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold text-text-main tracking-tight">Workspaces</h1>
        <p className="mt-1 text-xs text-text-sub">
          Access all of your teaching and team workspaces.
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-36 rounded-[16px]" />
          <Skeleton className="h-36 rounded-[16px]" />
          <Skeleton className="h-36 rounded-[16px]" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-[10px] bg-semantic-danger/10 border border-semantic-danger/20 text-semantic-danger text-xs">
          {error}
        </div>
      ) : workspaces.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No workspaces found"
          description="You are not a member of any workspaces yet. Create one from the Dashboard or join via code."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              onDelete={() => {}}
              isDeleting={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
