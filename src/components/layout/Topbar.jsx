import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Bell, Search } from 'lucide-react';

export default function Topbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Sign-out failed', error);
    }
  };

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'Dashboard';
    if (path.includes('/workspaces')) return 'Workspaces';
    if (path.includes('/assessments')) return 'Assessments';
    if (path.includes('/settings')) return 'Settings';
    return 'Home';
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800/50 bg-slate-950/20 backdrop-blur-sm z-40 sticky top-0">
      {/* Left: Breadcrumbs / Page Title */}
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-semibold text-slate-200 tracking-wide">
          {getBreadcrumb()}
        </h2>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {/* Search Bar - Visual Only for now */}
        <div className="hidden md:flex items-center gap-2 bg-slate-900/50 border border-slate-800 rounded-full px-3 py-1.5 w-64 focus-within:ring-1 focus-within:ring-brand-500/50 transition-all">
          <Search size={14} className="text-slate-500" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent border-none outline-none text-xs text-slate-300 placeholder:text-slate-600 w-full"
          />
          <div className="flex items-center gap-0.5 text-[10px] text-slate-600 font-mono border border-slate-800 rounded px-1">
            <span>⌘</span><span>K</span>
          </div>
        </div>

        <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-slate-950"></span>
        </button>

        <div className="h-6 w-px bg-slate-800 mx-1"></div>

        {user && (
          <button
            onClick={handleSignOut}
            className="text-xs font-medium text-slate-400 hover:text-brand-300 transition-colors"
          >
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
}
