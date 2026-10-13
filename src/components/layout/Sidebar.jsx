import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  Settings,
  LogOut,
  Code2,
  ChevronDown,
  Pin,
  PinOff,
  Plus,
  Check,
  Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { getWorkspacesForUser } from '../../services/workspaceService';
import { DropdownMenu, DropdownItem, DropdownSeparator } from '../ui/DropdownMenu';
import Tooltip from '../ui/Tooltip';

export default function Sidebar({ onOpenCmd }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isPinned, setIsPinned] = useState(() => {
    try {
      return localStorage.getItem('collabspace-sidebar-pinned') === 'true';
    } catch {
      return false;
    }
  });
  const [isHovered, setIsHovered] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);

  // Check if we are inside a specific workspace route
  const workspaceMatch = location.pathname.match(/\/workspace\/([^\/]+)/);
  const activeWorkspaceId = workspaceMatch ? workspaceMatch[1] : null;

  useEffect(() => {
    if (!user) return;
    getWorkspacesForUser(user.id)
      .then((rows) => setWorkspaces(rows || []))
      .catch(() => {});
  }, [user?.id, activeWorkspaceId]);

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    try {
      localStorage.setItem('collabspace-sidebar-pinned', String(next));
    } catch {}
  };

  const isExpanded = isPinned || isHovered;
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

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

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`hidden md:flex flex-col justify-between border-r border-border-dim bg-surface/95 backdrop-blur-xl z-30 transition-[width] duration-200 ease-spring select-none relative
        ${isExpanded ? 'w-[240px]' : 'w-[72px]'}`}
    >
      <div className="flex flex-col h-full justify-between p-3">
        <div className="space-y-4">
          {/* Top Brand & Workspace Switcher */}
          <div className="flex items-center justify-between h-10 px-1">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-accent text-accent-fg shadow-sm">
                <Code2 size={20} />
              </div>
              {isExpanded && (
                <div className="min-w-0 overflow-hidden leading-tight">
                  <div className="text-xs font-bold text-text-main truncate">
                    CollabSpace
                  </div>
                  <div className="text-[10px] text-text-dim truncate">
                    {activeWorkspace ? activeWorkspace.name : 'Personal'}
                  </div>
                </div>
              )}
            </div>

            {isExpanded && (
              <button
                type="button"
                onClick={togglePin}
                className="text-text-dim hover:text-text-main p-1.5 rounded-[8px] hover:bg-subtle transition-colors shrink-0"
                aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              >
                {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
            )}
          </div>

          {/* Workspace Switcher Selector */}
          <div className="pt-1">
            <DropdownMenu
              align="left"
              className="w-56"
              trigger={
                <button
                  type="button"
                  className={`w-full flex items-center h-9 rounded-[10px] border border-border-dim bg-subtle hover:bg-elevated hover:border-border-strong text-xs text-text-main transition-colors focus-visible:ring-2 focus-visible:ring-accent
                    ${isExpanded ? 'px-2.5 justify-between' : 'justify-center p-0'}`}
                  aria-label="Switch workspace"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={16} className="text-text-sub shrink-0" />
                    {isExpanded && (
                      <span className="truncate font-medium">
                        {activeWorkspace ? activeWorkspace.name : 'Select Workspace'}
                      </span>
                    )}
                  </div>
                  {isExpanded && <ChevronDown size={13} className="text-text-dim shrink-0 ml-1" />}
                </button>
              }
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold text-text-dim uppercase tracking-wider">
                Your Workspaces
              </div>
              {workspaces.map((ws) => (
                <DropdownItem
                  key={ws.id}
                  onClick={() => navigate(`/app/workspace/${ws.id}`)}
                >
                  <span className="flex items-center justify-between w-full">
                    <span className="truncate">{ws.name}</span>
                    {ws.id === activeWorkspaceId && <Check size={13} className="text-accent" />}
                  </span>
                </DropdownItem>
              ))}
              <DropdownSeparator />
              <DropdownItem
                icon={Plus}
                onClick={() => navigate('/app/dashboard')}
              >
                New Workspace
              </DropdownItem>
            </DropdownMenu>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 pt-2">
            <RailItem
              to="/app/dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              isExpanded={isExpanded}
              currentPath={location.pathname}
            />
            <RailItem
              to="/app/workspaces"
              icon={FolderGit2}
              label="Workspaces"
              isExpanded={isExpanded}
              currentPath={location.pathname}
            />
            <RailItem
              to="/app/settings"
              icon={Settings}
              label="Settings"
              isExpanded={isExpanded}
              currentPath={location.pathname}
            />
          </nav>
        </div>

        {/* User Footer Profile */}
        <div className="border-t border-border-dim pt-3">
          <DropdownMenu
            align="left"
            className="w-56"
            trigger={
              <button
                type="button"
                className={`w-full flex items-center gap-2.5 rounded-[10px] p-1.5 hover:bg-subtle transition-colors text-left
                  ${isExpanded ? '' : 'justify-center'}`}
                aria-label="User account menu"
              >
                <div className="h-8 w-8 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-semibold border border-accent/20 shrink-0">
                  {initials}
                </div>
                {isExpanded && (
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-main truncate">
                      {displayName}
                    </div>
                    <div className="text-[11px] text-text-dim truncate">
                      {user?.email}
                    </div>
                  </div>
                )}
              </button>
            }
          >
            <div className="px-3 py-2 border-b border-border-dim">
              <div className="text-xs font-semibold text-text-main truncate">{displayName}</div>
              <div className="text-[11px] text-text-dim truncate">{user?.email}</div>
            </div>
            <DropdownItem icon={Settings} onClick={() => navigate('/app/settings')}>
              Settings
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={LogOut} danger onClick={handleSignOut}>
              Sign Out
            </DropdownItem>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  );
}

function RailItem({ to, icon: Icon, label, isExpanded, currentPath }) {
  const isActive = currentPath === to || (to !== '/app/dashboard' && currentPath.startsWith(to));

  const content = (
    <NavLink
      to={to}
      className={`relative flex items-center h-10 rounded-[10px] text-xs font-medium transition-colors select-none group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${isExpanded ? 'px-3 gap-3' : 'justify-center px-0'}
        ${isActive ? 'text-text-main font-semibold' : 'text-text-sub hover:text-text-main hover:bg-subtle'}`}
    >
      {isActive && (
        <motion.div
          layoutId="railActiveIndicator"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="absolute inset-0 bg-accent/15 border border-accent/25 rounded-[10px] -z-10"
        />
      )}
      <Icon
        size={18}
        className={`shrink-0 transition-colors ${isActive ? 'text-accent' : 'text-text-dim group-hover:text-text-main'}`}
      />
      {isExpanded && <span className="truncate">{label}</span>}
    </NavLink>
  );

  if (!isExpanded) {
    return (
      <Tooltip content={label} position="right">
        {content}
      </Tooltip>
    );
  }

  return content;
}
