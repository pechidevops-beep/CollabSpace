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

export function validateRepositoryName(name) {
  if (!name || typeof name !== 'string') {
    return 'Repository name is required.';
  }
  if (name.length < 1 || name.length > 100) {
    return 'Repository name must be between 1 and 100 characters.';
  }
  if (/^\.+$/.test(name)) {
    return 'Repository name cannot consist only of dots.';
  }
  if (!/^[a-zA-Z0-9_\-.]+$/.test(name)) {
    return 'Repository name can only contain letters, numbers, hyphens, underscores, and dots.';
  }
  if (/[\x00-\x1f\x7f]/.test(name)) {
    return 'Repository name cannot contain control characters.';
  }
  return null;
}

export function validateFileName(name) {
  if (!name || typeof name !== 'string') {
    return 'Name is required.';
  }
  if (name.length < 1 || name.length > 100) {
    return 'Name must be between 1 and 100 characters.';
  }
  if (name === '.' || name === '..') {
    return 'Name cannot be "." or "..".';
  }
  if (name.includes('/') || name.includes('\\')) {
    return 'Name cannot contain path separators (/ or \\).';
  }
  if (!/^[a-zA-Z0-9_\-.]+$/.test(name)) {
    return 'Name can only contain letters, numbers, hyphens, underscores, and dots.';
  }
  if (/[\x00-\x1f\x7f]/.test(name)) {
    return 'Name cannot contain control characters.';
  }
  return null;
}

export function mapRepositoryDbError(error) {
  if (!error) return new Error('An unknown error occurred');
  const msg = error.message || String(error);
  if (msg.includes('repositories_name_format_check')) {
    return new Error('Repository name must be 1 to 100 characters, using only letters, numbers, hyphens, underscores, or dots, and cannot consist solely of dots.');
  }
  if (msg.includes('repository_files_filename_safe_check')) {
    return new Error('File or folder name must be 1 to 100 characters using only letters, numbers, hyphens, underscores, or dots, without slashes, and cannot be "." or "..".');
  }
  if (msg.includes('idx_repository_files_unique_entry') || (error.code === '23505' && msg.includes('repository_files'))) {
    return new Error('An item with this name already exists in this folder.');
  }
  if (msg.includes('repository_files_content_limit_check')) {
    return new Error('File content exceeds the maximum allowed size of 512 KB.');
  }
  return error instanceof Error ? error : new Error(msg);
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
  const validationError = validateRepositoryName(name);
  if (validationError) {
    throw new Error(validationError);
  }

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
  if (error) throw mapRepositoryDbError(error);

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

function getContentByteLength(content) {
  if (content === null || content === undefined) return 0;
  if (typeof content !== 'string') return 0;
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(content).length;
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(content, 'utf8');
  }
  return content.length;
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

  const validationError = validateFileName(name);
  if (validationError) {
    throw new Error(validationError);
  }

  if (getContentByteLength(content) > 524288) {
    throw new Error('File content exceeds the maximum allowed size of 512 KB.');
  }

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
  if (error) throw mapRepositoryDbError(error);

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

  const validationError = validateFileName(name);
  if (validationError) {
    throw new Error(validationError);
  }

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
  if (error) throw mapRepositoryDbError(error);

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
  const validationError = validateFileName(newName);
  if (validationError) {
    throw new Error(validationError);
  }

  const { data, error } = await supabase
    .from('repository_files')
    .update({ name: newName, updated_at: new Date().toISOString() })
    .eq('id', fileId)
    .select('*')
    .maybeSingle();
  if (error) throw mapRepositoryDbError(error);
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
  if (fetchError) throw mapRepositoryDbError(fetchError);

  const { error } = await supabase
    .from('repository_files')
    .delete()
    .eq('id', fileId);
  if (error) throw mapRepositoryDbError(error);

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
  if (getContentByteLength(content) > 524288) {
    throw new Error('File content exceeds the maximum allowed size of 512 KB.');
  }

  const { data, error } = await supabase
    .from('repository_files')
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fileId)
    .select('*')
    .maybeSingle();
  if (error) throw mapRepositoryDbError(error);
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
