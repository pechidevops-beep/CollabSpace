import { supabase } from '../lib/supabaseClient';
import { logActivity } from './activityService';
import { createNotification } from './notificationService';


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
  const { data, error } = await supabase.rpc('list_workspace_members', {
    workspace_id: workspaceId,
  });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.user_id,
    user_id: m.user_id,
    role: m.role,
    created_at: m.joined_date,
    profiles: {
      id: m.user_id,
      full_name: m.full_name,
      email: m.email,
    },
  }));
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

export function validateWorkspaceName(name) {
  if (!name || typeof name !== 'string') {
    return 'Workspace name is required.';
  }
  if (name.length < 1 || name.length > 100) {
    return 'Workspace name must be between 1 and 100 characters.';
  }
  if (name.trim() !== name) {
    return 'Workspace name cannot contain leading or trailing spaces.';
  }
  if (name.includes('<') || name.includes('>')) {
    return 'Workspace name cannot contain angle brackets (< or >).';
  }
  if (/[\x00-\x1f\x7f]/.test(name)) {
    return 'Workspace name cannot contain control characters.';
  }
  return null;
}

export async function createWorkspace({ ownerId, name, type = 'team' }) {
  const validationError = validateWorkspaceName(name);
  if (validationError) {
    throw new Error(validationError);
  }

  const { data: workspace, error: insertError } = await supabase
    .from('workspaces')
    .insert({
      owner_id: ownerId,
      name,
      type,
    })
    .select('*')
    .maybeSingle();

  if (insertError || !workspace) {
    let msg = insertError?.message ?? 'Failed to create workspace';
    if (insertError?.message?.includes('workspaces_name_format_check')) {
      msg = 'Workspace name must be between 1 and 100 characters, trimmed, without angle brackets (<>) or control characters.';
    }
    throw new Error(msg);
  }

  // Note: Database trigger `tr_workspace_created` automatically inserts owner into workspace_members.

  await logActivity({
    type: 'workspace_created',
    actorId: ownerId,
    workspaceId: workspace.id,
    message: `Workspace "${workspace.name}" was created.`,
  }).catch(() => {});

  return workspace;
}

export async function joinWorkspace({ userId, codeOrId }) {
  const code = (codeOrId || '').trim();
  if (!code) {
    throw new Error('Please enter a workspace join code.');
  }

  const { data, error } = await supabase.rpc('join_workspace', { code });
  if (error) {
    if (error.message?.includes('Too many join attempts')) {
      throw new Error('Too many join attempts. Please wait 10 minutes and try again.');
    }
    if (error.message?.includes('Invalid workspace code')) {
      throw new Error('Invalid workspace code. Please verify the code and try again.');
    }
    if (error.message?.includes('already a member')) {
      throw new Error('You are already a member of this workspace.');
    }
    if (error.message?.includes('owner of this workspace')) {
      throw new Error('You are already the owner of this workspace.');
    }
    throw new Error(error.message || 'Failed to join workspace.');
  }

  return {
    workspace: {
      id: data?.workspace_id,
      name: data?.workspace_name,
    },
    member: {
      role: data?.role || 'contributor',
    },
  };
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

export async function regenerateJoinCode(workspaceId) {
  const { data, error } = await supabase.rpc('regenerate_join_code', {
    workspace_id: workspaceId,
  });
  if (error) {
    if (error.message?.includes('Too many join code requests')) {
      throw new Error('Too many join code requests. Please wait a few minutes and try again.');
    }
    if (error.message?.includes('Permission denied')) {
      throw new Error('Permission denied. Only owners and admins can regenerate join codes.');
    }
    throw new Error(error.message || 'Failed to regenerate join code.');
  }
  return data;
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
