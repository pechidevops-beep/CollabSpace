import { supabase } from '../lib/supabaseClient';
import { logActivity } from './activityService';
import { createNotification } from './notificationService';

export function generateJoinCode() {
  const prefix = 'TEAM';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    const index = Math.floor(Math.random() * chars.length);
    suffix += chars[index];
  }
  return `${prefix}-${suffix}`;
}

export async function getWorkspacesForUser(userId) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, workspaces ( id, name, type, created_at, join_code, owner_id )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false, foreignTable: 'workspaces' });

  if (error) throw error;

  return (data ?? [])
    .filter((row) => row.workspaces)
    .map((row) => ({
      id: row.workspaces.id,
      name: row.workspaces.name,
      type: row.workspaces.type,
      role: row.role,
      created_at: row.workspaces.created_at,
      join_code: row.workspaces.join_code,
      owner_id: row.workspaces.owner_id,
    }));
}

export async function getWorkspaceById(workspaceId) {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getWorkspaceMembers(workspaceId) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*, profiles:user_id ( id, full_name, email )')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  return data ?? [];
}

export async function getWorkspaceMemberRole(workspaceId, userId) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}

export async function createWorkspace({ ownerId, name, type = 'team' }) {
  const { data: workspace, error: insertError } = await supabase
    .from('workspaces')
    .insert({
      owner_id: ownerId,
      name,
      type,
      join_code: generateJoinCode(),
    })
    .select('*')
    .maybeSingle();

  if (insertError || !workspace) throw insertError ?? new Error('Failed to create workspace');

  const { error: memberError } = await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: ownerId,
    role: 'owner',
  });

  if (memberError) throw memberError;

  await logActivity({
    type: 'workspace_created',
    actorId: ownerId,
    workspaceId: workspace.id,
    message: `Workspace "${workspace.name}" was created.`,
  });

  return workspace;
}

export async function joinWorkspace({ userId, codeOrId }) {
  const raw = (codeOrId || '').trim();
  const code = raw.toUpperCase();
  const isJoinCodeFormat = /^TEAM-[A-Z0-9]{4}$/.test(code);
  const isUuidFormat =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

  if (!isJoinCodeFormat && !isUuidFormat) {
    throw new Error('That does not look like a valid workspace code.');
  }

  let workspace = null;

  if (isJoinCodeFormat) {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, type, created_at, join_code, owner_id')
      .eq('join_code', code)
      .maybeSingle();
    if (error) throw error;
    workspace = data;
  } else {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, type, created_at, join_code, owner_id')
      .eq('id', raw)
      .maybeSingle();
    if (error) throw error;
    workspace = data;
  }

  if (!workspace) {
    throw new Error('No workspace found for that code.');
  }

  if (workspace.owner_id === userId) {
    throw new Error('You are the owner of this workspace already.');
  }

  const { data: existing, error: memberError } = await supabase
    .from('workspace_members')
    .select('id, role, created_at')
    .eq('workspace_id', workspace.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (memberError) throw memberError;
  if (existing) {
    throw new Error('You are already a member of this workspace.');
  }

  const { data: member, error: insertError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'contributor',
    })
    .select('*')
    .maybeSingle();

  if (insertError) throw insertError;

  await logActivity({
    type: 'workspace_joined',
    actorId: userId,
    workspaceId: workspace.id,
    message: `A member joined workspace "${workspace.name}".`,
  });

  return { workspace, member };
}

export async function deleteWorkspace({ workspaceId, actorId }) {
  const role = await getWorkspaceMemberRole(workspaceId, actorId);
  if (role !== 'owner') {
    throw new Error('Only owners can delete workspaces.');
  }

  const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
  if (error) throw error;

  await logActivity({
    type: 'workspace_deleted',
    actorId,
    workspaceId,
    message: 'Workspace deleted.',
  });
}

export async function inviteWorkspaceMember({ workspaceId, email }) {
  const { data: targetProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('email', email)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!targetProfile) throw new Error('User not found with that email.');

  const { data: existing, error: memberError } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', targetProfile.id)
    .maybeSingle();

  if (memberError) throw memberError;
  if (existing) throw new Error('User is already a member.');

  const { data: newMember, error: insertError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: targetProfile.id,
      role: 'contributor',
    })
    .select('*, profiles:user_id ( id, full_name, email )')
    .maybeSingle();

  if (insertError) throw insertError;
  return newMember;
}

export async function getDashboardStats(userId) {
  const { data: memberRows, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId);

  if (memberError) throw memberError;

  const wsIds = (memberRows ?? []).map((row) => row.workspace_id);
  if (wsIds.length === 0) {
    return { totalRepos: 0, totalMembers: 0 };
  }

  const { count: repoCount, error: repoError } = await supabase
    .from('repositories')
    .select('id', { count: 'exact', head: true })
    .in('workspace_id', wsIds);
  if (repoError) throw repoError;

  const { count: memberCount, error: countError } = await supabase
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .in('workspace_id', wsIds);
  if (countError) throw countError;

  return {
    totalRepos: repoCount ?? 0,
    totalMembers: memberCount ?? 0,
  };
}

/**
 * Update a workspace member's role.
 * Only owners and admins can change roles.
 * Cannot change the owner's role.
 */
export async function updateMemberRole({ workspaceId, memberId, newRole, actorId }) {
  // Validate the role
  const validRoles = ['viewer', 'contributor', 'admin'];
  if (!validRoles.includes(newRole)) {
    throw new Error(`Invalid role: ${newRole}`);
  }

  // Check actor permission
  const actorRole = await getWorkspaceMemberRole(workspaceId, actorId);
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    throw new Error('You do not have permission to change roles.');
  }

  // Prevent changing the owner's role
  const { data: member } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('id', memberId)
    .maybeSingle();

  if (!member) throw new Error('Member not found.');
  if (member.role === 'owner') throw new Error('Cannot change the owner\'s role.');

  // Admins cannot promote others to admin or above (only owner can)
  if (actorRole === 'admin' && newRole === 'admin') {
    throw new Error('Only the owner can promote members to admin.');
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .update({ role: newRole })
    .eq('id', memberId)
    .select('*, profiles:user_id ( id, full_name, email )')
    .maybeSingle();

  if (error) throw error;

  await logActivity({
    type: 'role_changed',
    actorId,
    workspaceId,
    message: `Member role changed to ${newRole}.`,
  });

  // Notify the affected member
  if (member.user_id) {
    createNotification({
      userId: member.user_id,
      workspaceId,
      type: 'role_changed',
      title: `Your role has been changed to ${newRole}`,
    }).catch(() => { });
  }

  return data;
}

/**
 * Remove a member from a workspace.
 * Only owners and admins can remove members.
 * Cannot remove the owner.
 */
export async function removeMember({ workspaceId, memberId, actorId }) {
  const actorRole = await getWorkspaceMemberRole(workspaceId, actorId);
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    throw new Error('You do not have permission to remove members.');
  }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('id', memberId)
    .maybeSingle();

  if (!member) throw new Error('Member not found.');
  if (member.role === 'owner') throw new Error('Cannot remove the workspace owner.');

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('id', memberId);

  if (error) throw error;

  await logActivity({
    type: 'member_removed',
    actorId,
    workspaceId,
    message: 'A member was removed from the workspace.',
  });

  // Notify the removed member
  if (member.user_id) {
    createNotification({
      userId: member.user_id,
      workspaceId,
      type: 'member_removed',
      title: 'You have been removed from a workspace',
    }).catch(() => { });
  }
}
