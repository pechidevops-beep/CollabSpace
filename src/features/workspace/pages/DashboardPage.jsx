import React, { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import PageTransition from '../../../components/shared/PageTransition';
import DashboardHero from '../components/DashboardHero';
import DashboardStats from '../components/DashboardStats';
import WorkspaceCard from '../components/WorkspaceCard';
import Skeleton from '../../../components/ui/Skeleton';
import Button from '../../../components/ui/Button';
import { gsap } from 'gsap';
import { Plus, Command } from 'lucide-react';
import ActivityFeed from '../../activity/components/ActivityFeed';
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

export default function DashboardPage() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newName, setNewName] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState('');

  const workspaceSectionRef = useRef(null);
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

  // Activity GSAP Stagger
  useLayoutEffect(() => {
    if (!activityLoading && activity.length > 0) {
      const ctx = gsap.context(() => {
        gsap.from(".activity-item", {
          x: -10,
          opacity: 0,
          duration: 0.4,
          stagger: 0.05,
          ease: "power2.out",
          delay: 0.5
        });
      });
      return () => ctx.revert();
    }
  }, [activityLoading, activity]);

  // Workspace Stagger
  useLayoutEffect(() => {
    if (!loading && workspaces.length > 0 && workspaceSectionRef.current) {
      const children = workspaceSectionRef.current.children;
      // Ensure cards are visible immediately
      gsap.set(children, { opacity: 1, y: 0 });
      const ctx = gsap.context(() => {
        gsap.fromTo(children,
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            stagger: 0.1,
            ease: "power2.out",
            delay: 0.2,
            onComplete: () => {
              // Remove inline styles so CSS takes over
              gsap.set(children, { clearProps: 'all' });
            }
          }
        );
      }, workspaceSectionRef);
      return () => {
        ctx.revert();
        // Ensure cards are visible after animation cleanup
        if (workspaceSectionRef.current) {
          gsap.set(workspaceSectionRef.current.children, { opacity: 1, y: 0, clearProps: 'all' });
        }
      };
    }
  }, [loading, workspaces]);

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
    } catch (err) {
      setCreateError(err?.message || 'Failed to create workspace');
    }

    setCreating(false);
  };

  const handleDeleteWorkspace = async (workspace) => {
    if (!user || workspace.role !== 'owner') return;

    const confirmed = window.confirm(
      `Delete workspace "${workspace.name}" and its repositories? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(workspace.id);
    setDeleteError('');

    try {
      await deleteWorkspace({ workspaceId: workspace.id, actorId: user.id });
      setWorkspaces((prev) => prev.filter((ws) => ws.id !== workspace.id));
    } catch (err) {
      setDeleteError(err?.message || 'Failed to delete workspace.');
    }

    setDeletingId(null);
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
        role: member?.role ?? 'member',
        created_at: member?.created_at || workspace.created_at,
      };

      setWorkspaces((prev) => {
        if (prev.some((ws) => ws.id === workspace.id)) return prev;
        return [mapped, ...prev];
      });

      setJoinCode('');
      setJoinOpen(false);
    } catch (err) {
      setJoinError(err?.message || 'Failed to join workspace.');
    }

    setJoining(false);
  };


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

  return (
    <PageTransition>
      <div className="min-h-full pb-10">
        <DashboardHero />

        <DashboardStats workspaces={workspaces} loading={loading} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Your Workspaces</h2>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  icon={Command}
                  onClick={() => {
                    setJoinOpen(true);
                    setCreateOpen(false);
                  }}
                >
                  Join Code
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  icon={Plus}
                  onClick={() => {
                    setCreateOpen(true);
                    setJoinOpen(false);
                  }}
                >
                  New Workspace
                </Button>
              </div>
            </div>

            {createOpen && (
              <div className="glass-panel p-6 rounded-xl animate-fade-in mb-6 border border-brand-500/20">
                <h3 className="text-lg font-medium text-white mb-4">Create New Workspace</h3>
                <form onSubmit={handleCreateWorkspace} className="flex gap-4">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Workspace Name (e.g. Engineering Team)"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="btn btn-primary w-32"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateOpen(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </form>
                {createError && <p className="text-red-400 text-sm mt-2">{createError}</p>}
              </div>
            )}

            {joinOpen && (
              <div className="glass-panel p-6 rounded-xl animate-fade-in mb-6 border border-slate-700">
                <h3 className="text-lg font-medium text-white mb-4">Join via Code</h3>
                <form onSubmit={handleJoinWorkspace} className="flex gap-4">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono uppercase"
                    placeholder="TEAM-XXXX"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={joining || !joinCode.trim()}
                    className="btn btn-primary w-32"
                  >
                    {joining ? 'Joining...' : 'Join'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinOpen(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </form>
                {joinError && <p className="text-red-400 text-sm mt-2">{joinError}</p>}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(n => (
                  <Skeleton key={n} className="h-40 rounded-xl" />
                ))}
              </div>
            ) : (
              <div ref={workspaceSectionRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workspaces.map(ws => (
                  <WorkspaceCard
                    key={ws.id}
                    workspace={ws}
                    onDelete={handleDeleteWorkspace}
                    isDeleting={deletingId === ws.id}
                  />
                ))}
                {workspaces.length === 0 && !createOpen && !joinOpen && (
                  <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                    <p className="text-slate-400 mb-4">You haven't joined any workspaces yet.</p>
                    <button
                      onClick={() => setCreateOpen(true)}
                      className="text-brand-400 hover:text-brand-300 font-medium hover:underline"
                    >
                      Create your first workspace
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="glass-panel p-6 rounded-xl sticky top-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Latest Activity</h3>

              <ActivityFeed
                items={activity}
                loading={activityLoading}
                error={activityError}
                resolveMessage={activityFallback}
              />
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
