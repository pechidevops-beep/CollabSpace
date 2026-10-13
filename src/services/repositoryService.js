import { supabase } from '../lib/supabaseClient';
import { logActivity } from './activityService';
import { createBranch } from './branchService';

export async function getRepositories(workspaceId) {
  const { data, error } = await supabase
    .from('repositories')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRepositoryById(repoId) {
  const { data, error } = await supabase
    .from('repositories')
    .select('*')
    .eq('id', repoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getRepositoryWorkspaceId(repoId) {
  const { data, error } = await supabase
    .from('repositories')
    .select('workspace_id')
    .eq('id', repoId)
    .maybeSingle();
  if (error) throw error;
  return data?.workspace_id ?? null;
}

export async function createRepository({
  workspaceId,
  name,
  description = null,
  visibility = 'public',
  language = null,
  createdBy = null,
  defaultBranch = 'main',
}) {
  const { data, error } = await supabase
    .from('repositories')
    .insert({
      workspace_id: workspaceId,
      name,
      description,
      visibility,
      language,
      created_by: createdBy,
      default_branch: defaultBranch,
      last_updated: new Date().toISOString(),
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;

  try {
    await createBranch({
      repositoryId: data?.id,
      name: defaultBranch,
      createdBy,
    });
  } catch (branchError) {
    // Avoid failing repo creation if branch insert fails (e.g., RLS or existing branch)
    // Consumers can still create the branch manually.
    console.warn('Branch creation skipped:', branchError?.message || branchError);
  }

  await logActivity({
    type: 'repo_created',
    actorId: createdBy,
    workspaceId,
    repositoryId: data?.id,
    message: `Repository "${name}" was created.`,
  });

  return data;
}

export async function deleteRepository(repoId) {
  const { error } = await supabase.from('repositories').delete().eq('id', repoId);
  if (error) throw error;
}

export async function getRepositoryFiles(repoId) {
  const { data, error } = await supabase
    .from('repository_files')
    .select('*')
    .eq('repository_id', repoId)
    .order('type', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getRepositoryFileById(fileId) {
  const { data, error } = await supabase
    .from('repository_files')
    .select('*')
    .eq('id', fileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createRepositoryFile({
  repoId,
  repositoryId,
  name,
  parentId = null,
  content = '',
  createdBy = null,
  actorId = null,
}) {
  const actualRepoId = repoId || repositoryId;
  const actualActorId = createdBy || actorId;

  const { data, error } = await supabase
    .from('repository_files')
    .insert({
      repository_id: actualRepoId,
      name,
      type: 'file',
      parent_id: parentId,
      content,
      created_by: actualActorId,
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;

  const workspaceId = await getRepositoryWorkspaceId(actualRepoId);
  await logActivity({
    type: 'file_created',
    actorId: actualActorId,
    workspaceId,
    repositoryId: actualRepoId,
    message: `File "${name}" was created.`,
  });

  return data;
}

export async function createRepositoryFolder({
  repoId,
  repositoryId,
  name,
  parentId = null,
  createdBy = null,
  actorId = null,
}) {
  const actualRepoId = repoId || repositoryId;
  const actualActorId = createdBy || actorId;

  const { data, error } = await supabase
    .from('repository_files')
    .insert({
      repository_id: actualRepoId,
      name,
      type: 'folder',
      parent_id: parentId,
      content: null,
      created_by: actualActorId,
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;

  const workspaceId = await getRepositoryWorkspaceId(actualRepoId);
  await logActivity({
    type: 'folder_created',
    actorId: actualActorId,
    workspaceId,
    repositoryId: actualRepoId,
    message: `Folder "${name}" was created.`,
  });

  return data;
}

export async function renameRepositoryFile({ fileId, newName, actorId = null }) {
  const { data, error } = await supabase
    .from('repository_files')
    .update({ name: newName, updated_at: new Date().toISOString() })
    .eq('id', fileId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (data?.repository_id) {
    const workspaceId = await getRepositoryWorkspaceId(data.repository_id);
    await logActivity({
      type: 'file_renamed',
      actorId,
      workspaceId,
      repositoryId: data.repository_id,
      message: `Renamed to "${newName}".`,
    });
  }
  return data;
}

export async function deleteRepositoryFile({ fileId, actorId = null }) {
  const { data: file, error: fetchError } = await supabase
    .from('repository_files')
    .select('id, name, repository_id')
    .eq('id', fileId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('repository_files')
    .delete()
    .eq('id', fileId);
  if (error) throw error;

  if (file?.repository_id) {
    const workspaceId = await getRepositoryWorkspaceId(file.repository_id);
    await logActivity({
      type: 'file_deleted',
      actorId,
      workspaceId,
      repositoryId: file.repository_id,
      message: `Deleted "${file.name}".`,
    });
  }
}

export async function updateRepositoryFileContent({ fileId, content, actorId = null }) {
  const { data, error } = await supabase
    .from('repository_files')
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fileId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (data?.repository_id) {
    const workspaceId = await getRepositoryWorkspaceId(data.repository_id);
    await logActivity({
      type: 'file_updated',
      actorId,
      workspaceId,
      repositoryId: data.repository_id,
      message: `Updated "${data.name}".`,
    });
  }
  return data;
}
