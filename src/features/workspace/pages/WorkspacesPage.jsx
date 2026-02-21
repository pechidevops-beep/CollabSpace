import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { getWorkspacesForUser } from '../../../services/workspaceService';

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
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-50">Workspaces</h1>
        <p className="mt-1 text-sm text-slate-400">
          Access all of your teaching and team workspaces.
        </p>
      </header>

      <section className="glass-panel hover-float rounded-lg p-4">
        <h2 className="text-sm font-medium text-slate-100">Your workspaces</h2>
        {loading && (
          <p className="mt-2 text-xs text-slate-500">Loading workspaces...</p>
        )}
        {error && !loading && (
          <p className="mt-2 text-xs text-rose-400">{error}</p>
        )}
        {!loading && !error && workspaces.length === 0 && (
          <p className="mt-2 text-xs text-slate-500">
            You are not a member of any workspaces yet.
          </p>
        )}
        {!loading && !error && workspaces.length > 0 && (
          <ul className="mt-3 space-y-2 text-xs text-slate-300">
            {workspaces.map((ws) => (
              <li
                key={ws.id}
                className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 transition hover:border-brand-500/40 hover:bg-slate-900/90"
              >
                <div>
                  <Link
                    to={`/app/workspace/${ws.id}`}
                    className="text-slate-100 hover:text-brand-300"
                  >
                    {ws.name}
                  </Link>
                  <div className="text-[11px] text-slate-500">
                    {ws.type === 'classroom'
                      ? 'Assessments workspace'
                      : 'Team workspace'}
                  </div>
                </div>
                <span className="text-[11px] uppercase tracking-wide text-slate-500">
                  {ws.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

