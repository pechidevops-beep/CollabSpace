import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import DashboardHero from '../components/DashboardHero';
import ActivityFeed from '../../activity/components/ActivityFeed';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';
import Card, { CardRow } from '../../../components/ui/Card';
import CountUp from '../../../components/ui/CountUp';
import EmptyState from '../../../components/ui/EmptyState';
import { supabase } from '../../../lib/supabaseClient';
import {
  createWorkspace,
  getWorkspacesForUser,
  joinWorkspace,
  validateWorkspaceName,
} from '../../../services/workspaceService';
import {
  createRepository,
  validateRepositoryName,
} from '../../../services/repositoryService';
import {
  getActivityForUser,
  getWorkspaceIdsForUser,
  subscribeToActivity,
} from '../../../services/activityService';
import {
  Plus,
  Building2,
  Code2,
  Users,
  ChevronRight,
  FolderGit2,
  Terminal,
  BookOpen,
  KeyRound,
  Clock,
  Sparkles,
  GitCommit,
  FileCode,
} from 'lucide-react';

function formatRelativeTime(dateString) {
  if (!dateString) return 'recently';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return 'recently';
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Repositories state
  const [latestRepo, setLatestRepo] = useState(null);
  const [latestCommit, setLatestCommit] = useState(null);
  const [latestRepoFiles, setLatestRepoFiles] = useState([]);
  const [totalRepos, setTotalRepos] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newName, setNewName] = useState('');

  const [joinOpen, setJoinOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const [newRepoOpen, setNewRepoOpen] = useState(false);
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [newRepoWorkspaceId, setNewRepoWorkspaceId] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [repoError, setRepoError] = useState('');

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
      commit_created: 'Commit pushed to repository.',
      assignment_created: 'Assessment published.',
      submission_created: 'Assessment submitted.',
    };
    return map[item?.type] || 'Activity update.';
  };

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await getWorkspacesForUser(user.id);
        const wsList = rows || [];
        setWorkspaces(wsList);

        if (wsList.length > 0) {
          const wsIds = wsList.map((w) => w.id);
          // Fetch repositories
          const { data: repos } = await supabase
            .from('repositories')
            .select('*')
            .in('workspace_id', wsIds)
            .order('last_updated', { ascending: false });

          if (repos && repos.length > 0) {
            setLatestRepo(repos[0]);
            setTotalRepos(repos.length);

            // Fetch real latest commit and files to fill the hero tile
            const [commitRes, fileRes] = await Promise.all([
              supabase
                .from('commits')
                .select('*')
                .eq('repository_id', repos[0].id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
              supabase
                .from('repository_files')
                .select('*')
                .eq('repository_id', repos[0].id)
                .eq('type', 'file')
                .order('created_at', { ascending: false })
                .limit(3),
            ]);

            setLatestCommit(commitRes.data || null);
            setLatestRepoFiles(fileRes.data || []);
          } else {
            setLatestRepo(null);
            setLatestCommit(null);
            setLatestRepoFiles([]);
            setTotalRepos(0);
          }

          // Fetch member counts
          const { count } = await supabase
            .from('workspace_members')
            .select('id', { count: 'exact', head: true })
            .in('workspace_id', wsIds);

          setTotalMembers(count || wsList.length);
        } else {
          setLatestRepo(null);
          setTotalRepos(0);
          setTotalMembers(0);
        }
      } catch (err) {
        setError(err?.message ?? 'Failed to load workspaces');
      }
      setLoading(false);
    };

    fetchData();
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
        setActivity(rows || []);

        const workspaceIds = await getWorkspaceIdsForUser(user.id);
        if (workspaceIds?.length) {
          channel = subscribeToActivity(workspaceIds, (newItem) => {
            setActivity((prev) => [newItem, ...prev].slice(0, 5));
          });
        }
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

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
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

  const handleJoinWorkspace = async (e) => {
    e.preventDefault();
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

  const handleCreateRepo = async (e) => {
    e.preventDefault();
    if (!user || !newRepoName.trim() || !newRepoWorkspaceId) return;

    setCreatingRepo(true);
    setRepoError('');

    try {
      const repo = await createRepository({
        workspaceId: newRepoWorkspaceId,
        name: newRepoName.trim(),
        description: newRepoDesc.trim() || null,
        createdBy: user.id,
      });

      setNewRepoName('');
      setNewRepoDesc('');
      setNewRepoOpen(false);
      navigate(`/app/workspace/${newRepoWorkspaceId}/repo/${repo.id}/editor`);
    } catch (err) {
      setRepoError(err?.message || 'Failed to create repository');
    }
    setCreatingRepo(false);
  };

  const latestRepoWorkspace = latestRepo
    ? workspaces.find((w) => w.id === latestRepo.workspace_id)
    : null;

  return (
    <div className="space-y-8 animate-fade-up pb-12 select-none">
      {/* Greeting Header */}
      <DashboardHero />

      {/* 12-Column Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Wide Hero Tile (8 cols): Continue where you left off */}
        <div className="lg:col-span-8">
          <Card
            spotlight={true}
            className="p-6"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-xs font-medium text-text-sub">
                  <Sparkles size={14} className="text-accent" />
                  <span>Continue where you left off</span>
                </div>
                {latestRepo && (
                  <span className="text-[11px] text-text-dim flex items-center gap-1">
                    <Clock size={12} />
                    <span>Edited {formatRelativeTime(latestRepo.last_updated || latestRepo.created_at)}</span>
                  </span>
                )}
              </div>

              {latestRepo ? (
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <FolderGit2 size={20} className="text-accent shrink-0" />
                    <h2 className="text-lg sm:text-xl font-semibold text-text-main tracking-tight truncate">
                      {latestRepo.name}
                    </h2>
                  </div>
                  <p className="text-xs text-text-sub mt-1 leading-relaxed">
                    {latestRepo.description || 'Active collaborative repository.'}
                  </p>

                  {/* Real commit / file details to fill the gap */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {latestCommit && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-fill-subtle text-[11px] text-text-main font-mono">
                        <GitCommit size={13} className="text-accent shrink-0" />
                        <span className="truncate max-w-[200px]">{latestCommit.message}</span>
                      </div>
                    )}
                    {latestRepoFiles.map((f) => (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-fill-subtle border border-border-subtle text-[11px] font-mono text-text-sub"
                      >
                        <FileCode size={12} className="text-accent" />
                        <span>{f.name}</span>
                      </span>
                    ))}
                    {latestRepoWorkspace && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-fill-subtle border border-border-subtle text-[11px] text-text-sub">
                        <Building2 size={12} />
                        <span className="truncate">{latestRepoWorkspace.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <h2 className="text-base sm:text-lg font-semibold text-text-main tracking-tight">
                    Start your collaborative workspace
                  </h2>
                  <p className="text-xs text-text-sub mt-1 leading-relaxed max-w-lg">
                    Build projects, manage repositories, and run interactive coding assessments in one unified environment.
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      magnetic={true}
                      icon={Plus}
                      onClick={() => setCreateOpen(true)}
                    >
                      Create workspace
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={KeyRound}
                      onClick={() => setJoinOpen(true)}
                    >
                      Join with code
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {latestRepo && (
              <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between flex-wrap gap-3">
                <div className="text-xs text-text-sub">
                  Ready to resume your editor session
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  magnetic={true}
                  icon={Terminal}
                  onClick={() =>
                    navigate(
                      `/app/workspace/${latestRepo.workspace_id}/repo/${latestRepo.id}/editor`
                    )
                  }
                >
                  Open editor
                </Button>
              </div>
            )}
          </Card>

          {/* Quick Actions Row positioned in left column under hero card */}
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={() => {
                if (workspaces.length === 0) {
                  setCreateOpen(true);
                } else {
                  setNewRepoWorkspaceId(workspaces[0].id);
                  setNewRepoOpen(true);
                }
              }}
            >
              New repo
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={KeyRound}
              onClick={() => setJoinOpen(true)}
            >
              Join with code
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={BookOpen}
              onClick={() => {
                if (workspaces.length > 0) {
                  navigate(`/app/workspace/${workspaces[0].id}/classroom`);
                } else {
                  setCreateOpen(true);
                }
              }}
            >
              New assignment
            </Button>

            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                icon={Building2}
                onClick={() => setCreateOpen(true)}
              >
                Create workspace
              </Button>
            </div>
          </div>
        </div>

        {/* Side Tile (4 cols): Workspaces / Repositories / Members with Count-ups */}
        <div className="lg:col-span-4">
          <Card spotlight={true} className="p-6">
            <div>
              <h3 className="text-xs font-semibold text-text-sub uppercase tracking-wider">
                Workspace Overview
              </h3>
              <div className="mt-4 space-y-3">
                <CardRow className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-[8px] bg-fill-subtle flex items-center justify-center text-accent shrink-0">
                      <Building2 size={16} />
                    </div>
                    <span className="text-xs font-medium text-text-main">Workspaces</span>
                  </div>
                  <span className="text-lg font-semibold text-text-main font-mono">
                    <CountUp value={workspaces.length} />
                  </span>
                </CardRow>

                <CardRow className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-[8px] bg-fill-subtle flex items-center justify-center text-accent shrink-0">
                      <FolderGit2 size={16} />
                    </div>
                    <span className="text-xs font-medium text-text-main">Repositories</span>
                  </div>
                  <span className="text-lg font-semibold text-text-main font-mono">
                    <CountUp value={totalRepos} />
                  </span>
                </CardRow>

                <CardRow className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-[8px] bg-fill-subtle flex items-center justify-center text-accent shrink-0">
                      <Users size={16} />
                    </div>
                    <span className="text-xs font-medium text-text-main">Members</span>
                  </div>
                  <span className="text-lg font-semibold text-text-main font-mono">
                    <CountUp value={totalMembers} />
                  </span>
                </CardRow>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border-subtle text-[11px] text-text-dim text-right">
              Live workspace metrics
            </div>
          </Card>
        </div>
      </div>


      {/* Bottom Grid: Workspaces Rows & Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left (8 cols): Workspaces as Clickable Rows */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-main tracking-tight">
              Your Workspaces
            </h2>
            <span className="text-xs text-text-sub font-mono">
              {workspaces.length} active
            </span>
          </div>

          {error && (
            <div className="p-3.5 rounded-[10px] bg-semantic-danger/10 border border-semantic-danger/20 text-xs text-semantic-danger">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-2xl bg-subtle animate-pulse border border-border-subtle" />
              ))}
            </div>
          ) : workspaces.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                icon={Building2}
                title="No workspaces yet"
                description="Create a workspace to organize repositories and assignments with your team."
                actionLabel="Create Workspace"
                onAction={() => setCreateOpen(true)}
              />
            </Card>
          ) : (
            <div className="space-y-2.5">
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  onClick={() => navigate(`/app/workspace/${ws.id}`)}
                  className="card-signature spotlight-card p-4 flex items-center justify-between gap-4 cursor-pointer hover:border-border-strong hover:-translate-y-[1px] transition-all duration-150"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-10 w-10 rounded-[10px] bg-fill-subtle flex items-center justify-center text-accent shrink-0">
                      <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-text-main truncate">
                          {ws.name}
                        </span>
                        <Badge
                          variant={ws.role === 'owner' ? 'accent' : 'secondary'}
                          size="sm"
                        >
                          {ws.role || 'Member'}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-text-dim mt-0.5">
                        Created {formatRelativeTime(ws.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <ChevronRight size={15} className="text-text-dim group-hover:text-text-main" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right (4 cols): Activity Timeline */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-main tracking-tight">
              Activity
            </h2>
            <span className="text-xs text-text-sub">Recent</span>
          </div>

          <Card className="p-5">
            <ActivityFeed
              items={activity}
              loading={activityLoading}
              error={activityError}
              resolveMessage={activityFallback}
            />
          </Card>
        </div>
      </div>

      {/* Create Workspace Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Workspace"
      >
        <form onSubmit={handleCreateWorkspace} className="space-y-4">
          <Input
            label="Workspace Name"
            placeholder="e.g. Distributed Systems Lab"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
          />
          <p className="text-[11px] text-text-sub -mt-2">
            1–100 characters. Letters, numbers, spaces, and punctuation allowed. No angle brackets (&lt; &gt;).
          </p>
          {createError && (
            <p className="text-xs text-semantic-danger">{createError}</p>
          )}
          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={creating}
              disabled={creating || !newName.trim()}
            >
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Join Workspace Modal */}
      <Modal
        isOpen={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Join Workspace"
      >
        <form onSubmit={handleJoinWorkspace} className="space-y-4">
          <Input
            label="Workspace Code or ID"
            placeholder="Enter invite code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            required
            autoFocus
          />
          {joinError && (
            <p className="text-xs text-semantic-danger">{joinError}</p>
          )}
          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setJoinOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={joining}
              disabled={joining || !joinCode.trim()}
            >
              Join
            </Button>
          </div>
        </form>
      </Modal>

      {/* New Repository Modal */}
      <Modal
        isOpen={newRepoOpen}
        onClose={() => setNewRepoOpen(false)}
        title="Create Repository"
      >
        <form onSubmit={handleCreateRepo} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-sub mb-1.5">
              Target Workspace
            </label>
            <select
              value={newRepoWorkspaceId}
              onChange={(e) => setNewRepoWorkspaceId(e.target.value)}
              className="w-full h-10 px-3 rounded-[10px] bg-subtle border border-border-subtle text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-accent"
              required
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id} className="bg-surface text-text-main">
                  {ws.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Repository Name"
            placeholder="e.g. distributed-kv-store"
            value={newRepoName}
            onChange={(e) => setNewRepoName(e.target.value)}
            required
            autoFocus
          />
          <p className="text-[11px] text-text-sub -mt-2">
            1–100 characters. Letters, numbers, hyphens, underscores, and dots only. Cannot consist solely of dots.
          </p>

          <Input
            label="Description (Optional)"
            placeholder="Brief overview of repository"
            value={newRepoDesc}
            onChange={(e) => setNewRepoDesc(e.target.value)}
          />

          {repoError && (
            <p className="text-xs text-semantic-danger">{repoError}</p>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setNewRepoOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={creatingRepo}
              disabled={creatingRepo || !newRepoName.trim()}
            >
              Create Repository
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
