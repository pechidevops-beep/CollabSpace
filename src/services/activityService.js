import { supabase } from '../lib/supabaseClient';

export async function logActivity({
  type,
  actorId,
  workspaceId = null,
  repositoryId = null,
  assignmentId = null,
  message = null,
  metadata = null,
}) {
  const { data, error } = await supabase
    .from('activities')
    .insert({
      type,
      actor_id: actorId,
      workspace_id: workspaceId,
      repository_id: repositoryId,
      assignment_id: assignmentId,
      message,
      metadata,
    })
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getActivityForUser(userId, { limit = 10 } = {}) {
  const { data: memberships, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId);

  if (memberError) throw memberError;

  const workspaceIds = (memberships ?? []).map((row) => row.workspace_id);
  if (workspaceIds.length === 0) return [];

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .in('workspace_id', workspaceIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export function subscribeToActivity(workspaceIds, onInsert) {
  if (!workspaceIds || workspaceIds.length === 0) return null;

  const filter = `workspace_id=in.(${workspaceIds.join(',')})`;
  const channel = supabase
    .channel('activity-feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activities', filter },
      (payload) => {
        onInsert?.(payload.new);
      },
    )
    .subscribe();

  return channel;
}

export async function getWorkspaceIdsForUser(userId) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.workspace_id);
}
