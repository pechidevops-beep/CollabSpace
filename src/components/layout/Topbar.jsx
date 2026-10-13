import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ChevronRight, Settings, LogOut, Code2, LayoutDashboard, FolderGit2 } from 'lucide-react';
import NotificationBell from '../shared/NotificationBell';
import ThemeToggle from '../ui/ThemeToggle';
import { CommandPaletteTrigger } from '../ui/CommandPalette';
import { DropdownMenu, DropdownItem, DropdownSeparator } from '../ui/DropdownMenu';
import { getWorkspaceById } from '../../services/workspaceService';
import { getRepositoryById } from '../../services/repositoryService';

export default function Topbar({ onOpenCmd }) {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [resolvedNames, setResolvedNames] = useState({});

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (e) {
      console.error(e);
    }
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Parse path segments for clean Apple-style breadcrumbs
  const pathParts = location.pathname
    .split('/')
    .filter(Boolean)
    .filter((p) => p !== 'app');

  // Resolve UUIDs to human-readable names
  useEffect(() => {
    const wsIdx = pathParts.indexOf('workspace');
    if (wsIdx !== -1 && pathParts[wsIdx + 1]) {
      const wsId = pathParts[wsIdx + 1];
      if (!resolvedNames[wsId]) {
        getWorkspaceById(wsId)
          .then((ws) => {
            if (ws?.name) {
              setResolvedNames((prev) => ({ ...prev, [wsId]: ws.name }));
            }
          })
          .catch(() => {});
      }
    }

    const repoIdx = pathParts.indexOf('repo');
    if (repoIdx !== -1 && pathParts[repoIdx + 1]) {
      const rId = pathParts[repoIdx + 1];
      if (!resolvedNames[rId]) {
        getRepositoryById(rId)
          .then((r) => {
            if (r?.name) {
              setResolvedNames((prev) => ({ ...prev, [rId]: r.name }));
            }
          })
          .catch(() => {});
      }
    }
  }, [location.pathname]);

  const breadcrumbs = pathParts.map((part, index) => {
    const url = `/app/${pathParts.slice(0, index + 1).join('/')}`;
    const isUuid = /^[0-9a-f-]{16,}$/i.test(part);

    let label = part.charAt(0).toUpperCase() + part.slice(1);
    if (isUuid) {
      if (resolvedNames[part]) {
        label = resolvedNames[part];
      } else if (index > 0 && pathParts[index - 1] === 'workspace') {
        label = 'Workspace';
      } else if (index > 0 && pathParts[index - 1] === 'repo') {
        label = 'Repository';
      } else {
        label = 'Details';
      }
    }

    return { label, url, isLast: index === pathParts.length - 1 };
  });

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-border-dim bg-surface/80 backdrop-blur-md sticky top-0 z-20 select-none">
      {/* Breadcrumbs with resolved entity names */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
        <Link
          to="/app/dashboard"
          className="text-text-dim hover:text-text-main font-medium transition-colors"
        >
          App
        </Link>
        {breadcrumbs.map((crumb) => (
          <React.Fragment key={crumb.url}>
            <ChevronRight size={13} className="text-text-dim shrink-0" />
            {crumb.isLast ? (
              <span className="font-semibold text-text-main truncate max-w-[140px] md:max-w-[200px]">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.url}
                className="text-text-sub hover:text-text-main transition-colors truncate max-w-[120px]"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Right Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        <CommandPaletteTrigger onClick={onOpenCmd} className="hidden sm:inline-flex w-44 lg:w-56" />

        <ThemeToggle size="sm" />

        <NotificationBell />

        <DropdownMenu
          align="right"
          className="w-56"
          trigger={
            <button
              type="button"
              className="h-8 w-8 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-semibold border border-accent/20 hover:scale-105 active:scale-95 transition-transform"
              aria-label="User profile menu"
            >
              {initials}
            </button>
          }
        >
          <div className="px-3 py-2 border-b border-border-dim">
            <div className="text-xs font-semibold text-text-main truncate">{displayName}</div>
            <div className="text-[11px] text-text-dim truncate">{user?.email}</div>
          </div>
          <DropdownItem icon={Settings} onClick={() => navigate('/app/settings')}>
            Account Settings
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem icon={LogOut} danger onClick={handleSignOut}>
            Sign Out
          </DropdownItem>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function MobileNavBar() {
  const location = useLocation();

  const links = [
    { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/app/workspaces', icon: FolderGit2, label: 'Workspaces' },
    { to: '/app/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-surface/95 backdrop-blur-xl border-t border-border-dim z-40 flex items-center justify-around px-4 select-none"
    >
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = location.pathname === link.to || (link.to !== '/app/dashboard' && location.pathname.startsWith(link.to));

        return (
          <Link
            key={link.to}
            to={link.to}
            className={`flex flex-col items-center gap-1 py-1 px-3 text-[10px] font-medium transition-colors
              ${isActive ? 'text-accent' : 'text-text-sub hover:text-text-main'}`}
          >
            <Icon size={18} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
