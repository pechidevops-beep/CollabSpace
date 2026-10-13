import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import DashboardHero from '../components/DashboardHero';
import DashboardStats from '../components/DashboardStats';
import ActivityFeed from '../../activity/components/ActivityFeed';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';
import EmptyState from '../../../components/ui/EmptyState';
import Skeleton from '../../../components/ui/Skeleton';
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspacesForUser,
  joinWorkspace,
} from '../../../services/workspaceService';
import {
  getActivityForUser,
  getWorkspaceIdsForUser,
  subscribeToActivity,
} from '../../../services/activityService';
import {
  Plus,
  Command,
  Building2,
  ChevronRight,
  ArrowRight,
  FolderGit2,
  Sparkles,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Workspace creation modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newName, setNewName] = useState('');

  // Workspace join modal
  const [joinOpen, setJoinOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  // Activity Feed
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState('');

  const activityFallback = (item) => {
    if (item?.message) return item.message;
    const map = {
      workspace_created: 'Workspace created.',
      workspace_joined: 'Workspace joined.',
      repo_created: 'Repository created.',
      commit_created: 'Commit created.',
      assignment_created: 'Assignment created.',
      submission_created: 'Submission submitted.',
    };
    return map[item?.type] || 'Activity update.';
  };

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

  useEffect(() => {
    if (!user) {
      setActivity([]);
      setActivityLoading(false);
      return;
    }

    let channel;

    const fetchActivity = async () => {
      setActivityLoading(true);
      setActivityError('');

      try {
        const rows = await getActivityForUser(user.id, { limit: 5 });
        setActivity(rows);

        const workspaceIds = await getWorkspaceIdsForUser(user.id);
        channel = subscribeToActivity(workspaceIds, (newItem) => {
          setActivity((prev) => {
            const next = [newItem, ...prev];
            return next.slice(0, 5);
          });
        });
      } catch (err) {
        setActivityError(err?.message ?? 'Failed to load activity');
      }

      setActivityLoading(false);
    };

    fetchActivity();

    return () => {
      channel?.unsubscribe();
    };
  }, [user?.id]);

  const handleCreateWorkspace = async (event) => {
    event.preventDefault();
    if (!user || !newName.trim()) return;

    setCreating(true);
    setCreateError('');

    try {
      const workspace = await createWorkspace({
        ownerId: user.id,
        name: newName.trim(),
        type: 'team',
      });
      const mapped = {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        role: 'owner',
        created_at: workspace.created_at,
      };

      setWorkspaces((prev) => [mapped, ...prev]);
      setNewName('');
      setCreateOpen(false);
      navigate(`/app/workspace/${workspace.id}`);
    } catch (err) {
      setCreateError(err?.message || 'Failed to create workspace');
    }

    setCreating(false);
  };

  const handleJoinWorkspace = async (event) => {
    event.preventDefault();
    if (!user || !joinCode.trim()) return;

    setJoining(true);
    setJoinError('');

    try {
      const { workspace, member } = await joinWorkspace({
        userId: user.id,
        codeOrId: joinCode.trim(),
      });

      const mapped = {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        role: member?.role ?? 'contributor',
        created_at: member?.created_at || workspace.created_at,
      };

      setWorkspaces((prev) => {
        if (prev.some((ws) => ws.id === workspace.id)) return prev;
        return [mapped, ...prev];
      });

      setJoinCode('');
      setJoinOpen(false);
      navigate(`/app/workspace/${workspace.id}`);
    } catch (err) {
      setJoinError(err?.message || 'Failed to join workspace.');
    }

    setJoining(false);
  };

  // Determine latest activity for "Continue where you left off"
  const latestActivity = activity.length > 0 ? activity[0] : null;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Greeting Header */}
      <DashboardHero />

      {/* Compact Stat Strip */}
      <DashboardStats workspaces={workspaces} loading={loading} />

      {/* Continue where you left off */}
      {latestActivity && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-[14px] bg-surface border border-border-dim shadow-subtle">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-[10px] bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="text-[11px] font-medium text-text-sub uppercase tracking-wider">
                Continue where you left off
              </div>
              <div className="text-xs font-semibold text-text-main mt-0.5">
                {activityFallback(latestActivity)}
              </div>
            </div>
          </div>
          {workspaces.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              iconRight={ArrowRight}
              onClick={() => navigate(`/app/workspace/${workspaces[0].id}`)}
              className="self-start sm:self-auto"
            >
              Resume
            </Button>
          )}
        </div>
      )}

      {/* Main Grid: Workspaces Rows & Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Workspaces as Rows */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text-main tracking-tight">
                Workspaces
              </h2>
              <p className="text-xs text-text-sub mt-0.5">
                Access your teaching and collaborative projects
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                icon={Command}
                onClick={() => setJoinOpen(true)}
              >
                Join Code
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={Plus}
                onClick={() => setCreateOpen(true)}
              >
                New Workspace
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-16 w-full rounded-[10px]" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4 rounded-[10px] border border-semantic-danger/20 bg-semantic-danger/10 text-semantic-danger text-xs">
              {error}
            </div>
          ) : workspaces.length === 0 ? (
            <EmptyState
              icon={FolderGit2}
              title="No workspaces yet"
              description="Create a workspace for your team or class, or join one with an invite code."
              actionLabel="New Workspace"
              actionIcon={Plus}
              onAction={() => setCreateOpen(true)}
              secondaryActionLabel="Enter Join Code"
              onSecondaryAction={() => setJoinOpen(true)}
            />
          ) : (
            <div className="space-y-2">
              {workspaces.map((ws) => (
                <Link
                  key={ws.id}
                  to={`/app/workspace/${ws.id}`}
                  className="flex items-center justify-between p-3.5 rounded-[10px] border border-border-dim bg-surface hover:bg-subtle hover:border-border-strong transition-all duration-150 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-10 w-10 rounded-[10px] bg-subtle border border-border-dim flex items-center justify-center text-text-sub group-hover:text-accent transition-colors shrink-0">
                      <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-text-main group-hover:text-accent transition-colors truncate">
                        {ws.name}
                      </div>
                      <div className="text-[11px] text-text-dim mt-0.5 truncate">
                        {ws.type === 'classroom' ? 'Classroom' : 'Team'} workspace
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <Badge variant={ws.role === 'owner' ? 'accent' : 'default'} size="sm">
                      {ws.role}
                    </Badge>
                    <ChevronRight size={14} className="text-text-dim group-hover:text-text-main group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Activity Timeline */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-text-main tracking-tight">
              Recent Activity
            </h2>
            <p className="text-xs text-text-sub mt-0.5">
              Live updates across your projects
            </p>
          </div>

          <div className="p-4 rounded-[14px] bg-surface border border-border-dim shadow-subtle min-h-[220px]">
            <ActivityFeed
              items={activity}
              loading={activityLoading}
              error={activityError}
              resolveMessage={activityFallback}
            />
          </div>
        </div>
      </div>

      {/* Create Workspace Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Workspace"
        description="Workspaces organize repositories, members, and assignments in one place."
      >
        <form onSubmit={handleCreateWorkspace} className="space-y-4 mt-2">
          <Input
            label="Workspace Name"
            placeholder="e.g. Distributed Systems Lab"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
            error={createError}
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={creating}
              disabled={!newName.trim()}
            >
              Create Workspace
            </Button>
          </div>
        </form>
      </Modal>

      {/* Join Workspace Modal */}
      <Modal
        isOpen={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Join Workspace"
        description="Enter the 8-character invite code provided by your workspace admin."
      >
        <form onSubmit={handleJoinWorkspace} className="space-y-4 mt-2">
          <Input
            label="Join Code"
            placeholder="e.g. TEAM-4A8B"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            required
            autoFocus
            error={joinError}
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setJoinOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={joining}
              disabled={!joinCode.trim()}
            >
              Join Workspace
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
