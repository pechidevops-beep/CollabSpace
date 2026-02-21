import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
} from '../../services/notificationService';

const TYPE_ICONS = {
    assignment_created: '📝',
    submission_created: '📨',
    grade_received: '⭐',
    role_changed: '🛡️',
    workspace_joined: '👋',
    member_removed: '🚪',
    default: '🔔',
};

export default function NotificationBell() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);

    // Fetch unread count on mount and periodically
    useEffect(() => {
        if (!user) return;
        const fetch = async () => {
            try {
                const count = await getUnreadCount();
                setUnread(count);
            } catch { /* ignore */ }
        };
        fetch();
        const interval = setInterval(fetch, 30000); // poll every 30s
        return () => clearInterval(interval);
    }, [user?.id]);

    // Fetch notifications when dropdown opens
    useEffect(() => {
        if (!open || !user) return;
        const load = async () => {
            setLoading(true);
            try {
                const data = await getNotifications({ limit: 20 });
                setNotifications(data);
            } catch { /* ignore */ }
            setLoading(false);
        };
        load();
    }, [open, user?.id]);

    // Close dropdown on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleMarkRead = async (id) => {
        try {
            await markAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnread(prev => Math.max(0, prev - 1));
        } catch { /* ignore */ }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnread(0);
        } catch { /* ignore */ }
    };

    const handleDelete = async (id) => {
        try {
            await deleteNotification(id);
            const wasUnread = notifications.find(n => n.id === id)?.read === false;
            setNotifications(prev => prev.filter(n => n.id !== id));
            if (wasUnread) setUnread(prev => Math.max(0, prev - 1));
        } catch { /* ignore */ }
    };

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay < 7) return `${diffDay}d ago`;
        return d.toLocaleDateString();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setOpen(prev => !prev)}
                className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200"
                title="Notifications"
            >
                <Bell size={18} />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 flex items-center justify-center text-[9px] font-bold text-white bg-rose-500 rounded-full min-w-[18px] px-1 shadow-lg shadow-rose-500/30">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                        <h3 className="text-[12px] font-semibold text-slate-200">Notifications</h3>
                        {unread > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1"
                            >
                                <CheckCheck size={12} /> Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="flex items-center justify-center py-8 text-xs text-slate-500">
                                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2" />
                                Loading…
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <Bell size={24} className="text-slate-700 mb-2" />
                                <p className="text-[12px] text-slate-500">No notifications yet</p>
                                <p className="text-[10px] text-slate-600 mt-0.5">You're all caught up!</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n.id}
                                    className={`flex items-start gap-3 px-4 py-3 border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors group ${!n.read ? 'bg-brand-500/5' : ''
                                        }`}
                                >
                                    {/* Icon */}
                                    <span className="text-base mt-0.5 shrink-0">
                                        {TYPE_ICONS[n.type] || TYPE_ICONS.default}
                                    </span>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[11px] leading-snug ${!n.read ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                                            {n.title}
                                        </p>
                                        {n.message && (
                                            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                        )}
                                        <p className="text-[9px] text-slate-600 mt-1">{formatTime(n.created_at)}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!n.read && (
                                            <button
                                                onClick={() => handleMarkRead(n.id)}
                                                className="p-1 rounded text-slate-600 hover:text-brand-400 hover:bg-brand-500/10"
                                                title="Mark as read"
                                            >
                                                <Check size={11} />
                                            </button>
                                        )}
                                        {n.link && (
                                            <a
                                                href={n.link}
                                                onClick={() => { handleMarkRead(n.id); setOpen(false); }}
                                                className="p-1 rounded text-slate-600 hover:text-brand-400 hover:bg-brand-500/10"
                                                title="Go to"
                                            >
                                                <ExternalLink size={11} />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => handleDelete(n.id)}
                                            className="p-1 rounded text-slate-600 hover:text-rose-400 hover:bg-rose-500/10"
                                            title="Delete"
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    </div>

                                    {/* Unread dot */}
                                    {!n.read && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0 mt-1.5" />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
