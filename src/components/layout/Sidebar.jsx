import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderGit2, Settings, LogOut, Code2, Command } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../shared/NotificationBell';
import ThemeToggle from '../ui/ThemeToggle';
import { CommandPalette, useCommandPalette } from '../ui/CommandPalette';

export default function Sidebar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const cmdPalette = useCommandPalette();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (e) {
      console.error('Sign out error', e);
    }
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <>
      <aside className="hidden w-64 flex-col justify-between border-r border-border-dim bg-surface/90 backdrop-blur-xl p-4 md:flex z-40 select-none">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-brand-fg shadow-sm">
                <Code2 size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-text-main tracking-tight leading-none">
                  CollabSpace
                </div>
                <div className="text-[11px] font-medium text-text-dim mt-0.5">
                  Workspace
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle size="sm" />
              <NotificationBell />
            </div>
          </div>

          {/* Quick Command Trigger */}
          <button
            type="button"
            onClick={cmdPalette.open}
            className="w-full flex items-center justify-between h-9 px-3 rounded-[10px] bg-subtle border border-border-dim text-text-dim hover:text-text-main hover:border-border-strong text-xs transition-colors"
          >
            <span className="flex items-center gap-2">
              <Command size={13} />
              Search & commands
            </span>
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface border border-border-dim text-text-dim">
              {isMac ? '⌘K' : 'Ctrl+K'}
            </kbd>
          </button>

          {/* Navigation */}
          <nav className="space-y-1">
            <div className="px-3 mb-2 text-[10px] font-semibold text-text-dim uppercase tracking-wider">
              Main
            </div>
            <NavItem
              to="/app/dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              currentPath={location.pathname}
            />
            <NavItem
              to="/app/workspaces"
              icon={FolderGit2}
              label="Workspaces"
              currentPath={location.pathname}
            />

            <div className="px-3 mt-6 mb-2 text-[10px] font-semibold text-text-dim uppercase tracking-wider">
              Preferences
            </div>
            <NavItem
              to="/app/settings"
              icon={Settings}
              label="Settings"
              currentPath={location.pathname}
            />
          </nav>
        </div>

        {/* User Footer */}
        <div className="border-t border-border-dim pt-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-[10px] p-2 hover:bg-subtle transition-colors group text-left"
          >
            <div className="h-8 w-8 rounded-full bg-brand/15 text-brand flex items-center justify-center text-xs font-semibold border border-brand/20 shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-text-main group-hover:text-brand transition-colors truncate">
                {displayName}
              </div>
              <div className="text-[11px] text-text-dim truncate">
                {user?.email || 'No email'}
              </div>
            </div>
            <LogOut size={15} className="text-text-dim group-hover:text-text-main transition-colors shrink-0" />
          </button>
        </div>
      </aside>

      {/* Global Command Palette */}
      <CommandPalette isOpen={cmdPalette.isOpen} onClose={cmdPalette.close} />
    </>
  );
}

function NavItem({ to, icon: Icon, label, currentPath }) {
  const isActive = currentPath === to || currentPath.startsWith(`${to}/`);

  return (
    <NavLink
      to={to}
      className={`relative flex items-center gap-[12px] h-10 px-[12px] rounded-[10px] text-xs font-medium transition-colors select-none group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand
        ${isActive ? 'text-text-main font-semibold' : 'text-text-sub hover:text-text-main hover:bg-subtle'}`}
    >
      {isActive && (
        <motion.div
          layoutId="sidebarActiveIndicator"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="absolute inset-0 bg-brand/10 border border-brand/25 rounded-[10px] -z-10"
        />
      )}
      <Icon
        size={17}
        className={`shrink-0 transition-colors ${isActive ? 'text-brand' : 'text-text-dim group-hover:text-text-main'}`}
      />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}
