import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Folder, Settings, LogOut, Disc } from 'lucide-react';
import { gsap } from 'gsap';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../shared/NotificationBell';

export default function Sidebar() {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();

    const handleMouseEnter = (e) => {
        gsap.to(e.currentTarget, { scale: 1.02, duration: 0.2, ease: 'power2.out' });
        const icon = e.currentTarget.querySelector('.nav-icon');
        if (icon) {
            gsap.to(icon, { scale: 1.2, rotate: 5, duration: 0.3, ease: 'back.out(1.7)' });
        }
    };

    const handleMouseLeave = (e) => {
        gsap.to(e.currentTarget, { scale: 1, duration: 0.2, ease: 'power2.out' });
        const icon = e.currentTarget.querySelector('.nav-icon');
        if (icon) {
            gsap.to(icon, { scale: 1, rotate: 0, duration: 0.3, ease: 'power2.out' });
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            navigate('/');
        } catch (e) {
            console.error('Sign out error', e);
        }
    };

    // Real user data
    const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const initials = displayName
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <aside className="hidden w-64 flex-col gap-6 border-r border-slate-800 bg-slate-950/85 backdrop-blur-xl p-4 md:flex z-50">
            {/* Brand */}
            <div className="flex items-center gap-3 px-2 pt-2">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 shadow-lg shadow-brand-500/30">
                    <Disc className="text-white animate-spin-slow" size={20} />
                    <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20"></div>
                </div>
                <div>
                    <div className="text-lg font-bold text-white tracking-tight">CollabSpace</div>
                    <div className="text-[10px] font-medium text-brand-300 uppercase tracking-wider">Enterprise</div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1">
                <div className="flex items-center justify-between px-3 mb-2">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Main</span>
                    <NotificationBell />
                </div>
                <NavItem to="/app/dashboard" icon={Home} label="Dashboard" onHover={handleMouseEnter} onLeave={handleMouseLeave} />
                <NavItem to="/app/workspaces" icon={Folder} label="Workspaces" onHover={handleMouseEnter} onLeave={handleMouseLeave} />

                <div className="px-3 mt-8 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Settings
                </div>
                <NavItem to="/app/settings" icon={Settings} label="Settings" onHover={handleMouseEnter} onLeave={handleMouseLeave} />
            </nav>

            {/* Footer / User Profile */}
            <div className="border-t border-slate-800 pt-4">
                <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-xl p-3 hover:bg-white/5 transition-colors group"
                >
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600/30 to-purple-600/30 flex items-center justify-center text-xs font-semibold text-white border border-white/10 group-hover:border-brand-500/30 transition-colors">
                        {initials}
                    </div>
                    <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors truncate max-w-[130px]">
                            {displayName}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-[130px]">
                            {user?.email || 'No email'}
                        </div>
                    </div>
                    <LogOut size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
                </button>
            </div>
        </aside>
    );
}

function NavItem({ to, icon: Icon, label, onHover, onLeave }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => `sidebar-link group ${isActive ? 'active' : ''}`}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
        >
            <Icon size={18} className="nav-icon transition-colors" />
            <span>{label}</span>
        </NavLink>
    );
}
