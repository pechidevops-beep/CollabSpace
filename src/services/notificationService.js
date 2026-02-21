import { supabase } from '../lib/supabaseClient';

/**
 * Get notifications for the current user.
 */
export async function getNotifications({ limit = 20, unreadOnly = false } = {}) {
    let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (unreadOnly) {
        query = query.eq('read', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

/**
 * Get unread notification count.
 */
export async function getUnreadCount() {
    const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('read', false);
    if (error) throw error;
    return count ?? 0;
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
 * Create a notification (called from other services).
 */
export async function createNotification({
    userId,
    workspaceId = null,
    type,
    title,
    message = null,
    link = null,
}) {
    const { data, error } = await supabase
        .from('notifications')
        .insert({
            user_id: userId,
            workspace_id: workspaceId,
            type,
            title,
            message,
            link,
        })
        .select('*')
        .maybeSingle();
    if (error) throw error;
    return data;
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
