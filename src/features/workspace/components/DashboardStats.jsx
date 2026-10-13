import React, { useEffect, useState } from 'react';
import { LayoutGrid, FolderGit2, Users } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getDashboardStats } from '../../../services/workspaceService';
import Skeleton from '../../../components/ui/Skeleton';

export default function DashboardStats({ workspaces = [], loading = false }) {
  const { user } = useAuth();
  const totalWorkspaces = workspaces.length;

  const [totalRepos, setTotalRepos] = useState(0);
  const [activeMembers, setActiveMembers] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setStatsLoading(false);
      return;
    }
    getDashboardStats(user.id)
      .then(({ totalRepos, totalMembers }) => {
        setTotalRepos(totalRepos);
        setActiveMembers(totalMembers);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [user?.id, workspaces.length]);

  const isLoading = loading || statsLoading;

  if (isLoading) {
    return <Skeleton className="h-16 w-full rounded-[14px] mb-8" />;
  }

  const items = [
    { label: 'Workspaces', value: totalWorkspaces, icon: LayoutGrid },
    { label: 'Repositories', value: totalRepos, icon: FolderGit2 },
    { label: 'Collaborators', value: activeMembers, icon: Users },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-[14px] bg-surface border border-border-dim shadow-subtle mb-8">
      {items.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="flex items-center gap-3.5 flex-1 min-w-[140px]">
            <div className="h-9 w-9 rounded-[10px] bg-subtle border border-border-dim flex items-center justify-center text-accent shrink-0">
              <Icon size={16} />
            </div>
            <div>
              <div className="text-[11px] font-medium text-text-sub uppercase tracking-wider">
                {stat.label}
              </div>
              <div className="text-lg font-semibold text-text-main tracking-tight leading-none mt-1">
                {stat.value}
              </div>
            </div>
            {idx < items.length - 1 && (
              <div className="hidden sm:block h-8 w-[1px] bg-border-dim ml-auto" />
            )}
          </div>
        );
      })}
    </div>
  );
}
