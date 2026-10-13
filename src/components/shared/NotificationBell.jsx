import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Trash2, ExternalLink, Loader2 } from 'lucide-react';
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
                className="relative p-2 rounded-lg hover:bg-subtle transition-colors text-text-sub hover:text-text-main"
                title="Notifications"
            >
                <Bell size={17} />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-[9px] font-bold text-white bg-semantic-danger rounded-full min-w-[16px] h-4 px-1 shadow-sm">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border-dim rounded-[14px] shadow-2xl z-50 overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border-dim">
                        <h3 className="text-xs font-semibold text-text-main">Notifications</h3>
                        {unread > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-[11px] text-accent hover:underline flex items-center gap-1 font-medium"
                            >
                                <CheckCheck size={13} /> Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="flex items-center justify-center py-8 text-xs text-text-dim">
                                <Loader2 size={16} className="animate-spin text-accent mr-2" />
                                Loading…
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <Bell size={22} className="text-text-dim/50 mb-2" />
                                <p className="text-xs font-medium text-text-sub">No notifications yet</p>
                                <p className="text-[11px] text-text-dim mt-0.5">You're all caught up!</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n.id}
                                    className={`flex items-start gap-3 px-4 py-3 border-b border-border-dim last:border-b-0 hover:bg-subtle transition-colors group ${
                                        !n.read ? 'bg-accent/5' : ''
                                    }`}
                                >
                                    {/* Icon */}
                                    <span className="text-base mt-0.5 shrink-0">
                                        {TYPE_ICONS[n.type] || TYPE_ICONS.default}
                                    </span>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs leading-snug ${!n.read ? 'text-text-main font-semibold' : 'text-text-sub'}`}>
                                            {n.title}
                                        </p>
                                        {n.message && (
                                            <p className="text-[11px] text-text-sub mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                                        )}
                                        <p className="text-[10px] text-text-dim mt-1">{formatTime(n.created_at)}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!n.read && (
                                            <button
                                                onClick={() => handleMarkRead(n.id)}
                                                className="p-1 rounded text-text-dim hover:text-accent hover:bg-surface"
                                                title="Mark as read"
                                            >
                                                <Check size={12} />
                                            </button>
                                        )}
                                        {n.link && (
                                            <a
                                                href={n.link}
                                                onClick={() => { handleMarkRead(n.id); setOpen(false); }}
                                                className="p-1 rounded text-text-dim hover:text-accent hover:bg-surface"
                                                title="Go to"
                                            >
                                                <ExternalLink size={12} />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => handleDelete(n.id)}
                                            className="p-1 rounded text-text-dim hover:text-semantic-danger hover:bg-semantic-danger/10"
                                            title="Delete"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>

                                    {/* Unread dot */}
                                    {!n.read && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1.5" />
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
