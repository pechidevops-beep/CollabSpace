import { supabase } from '../lib/supabaseClient';

/**
 * Get notifications for the current user.
 */
export async function getNotifications({ limit = 20, unreadOnly = false } = {}) {
    try {
        let query = supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (unreadOnly) {
            query = query.eq('read', false);
        }

        const { data, error } = await query;
        if (error) {
            console.warn('[notifications] getNotifications error:', error.message);
            return [];
        }
        return data ?? [];
    } catch {
        return [];
    }
}

/**
 * Get unread notification count.
 */
export async function getUnreadCount() {
    try {
        const { count, error } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('read', false);
        if (error) {
            console.warn('[notifications] getUnreadCount error:', error.message);
            return 0;
        }
        return count ?? 0;
    } catch {
        return 0;
    }
}


/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId) {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
    if (error) throw error;
}

/**
 * Mark all notifications as read.
 */
export async function markAllAsRead() {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);
    if (error) throw error;
}

/**
 * Notify all members of a workspace via RPC (restricted to owner/admin).
 */
export async function notifyWorkspaceMembers({
    workspaceId,
    title,
    message = null,
    type = 'announcement',
}) {
    const { data, error } = await supabase.rpc('notify_workspace_members', {
        workspace_id: workspaceId,
        title,
        message,
        type,
    });
    if (error) {
        console.warn('Failed to send workspace notification:', error.message);
        throw error;
    }
    return data;
}

/**
 * Create a notification (routes through notify_workspace_members RPC if workspaceId provided).
 */
export async function createNotification({
    userId,
    workspaceId = null,
    type,
    title,
    message = null,
    link = null,
}) {
    if (workspaceId) {
        try {
            return await notifyWorkspaceMembers({
                workspaceId,
                title,
                message,
                type,
            });
        } catch (rpcErr) {
            console.warn('notify_workspace_members RPC failed:', rpcErr?.message);
            return null;
        }
    }
    // Direct client inserts are locked down under RLS; fail gracefully without throwing.
    return null;
}

/**
 * Delete a notification.
 */
export async function deleteNotification(notificationId) {
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
    if (error) throw error;
}
