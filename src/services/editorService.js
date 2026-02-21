import { supabase } from '../lib/supabaseClient';
import { logActivity } from './activityService';
import { buildFilePathMap } from '../utils/repository';

async function getRepositoryWorkspaceId(repositoryId) {
  const { data, error } = await supabase
    .from('repositories')
    .select('workspace_id')
    .eq('id', repositoryId)
    .maybeSingle();
  if (error) throw error;
  return data?.workspace_id ?? null;
}

export async function getFileById(fileId) {
  const { data, error } = await supabase
    .from('repository_files')
    .select('*')
    .eq('id', fileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateFileContent({ fileId, content, actorId = null }) {
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

export async function createCommit({
  repositoryId,
  message,
  createdBy,
  files = [],
}) {
  const snapshot = {};
  files
    .filter((f) => f.type === 'file')
    .forEach((file) => {
      snapshot[file.id] = {
        name: file.name,
        content: file.content ?? '',
      };
    });

  const { data: commit, error } = await supabase
    .from('commits')
    .insert({
      repository_id: repositoryId,
      message,
      created_by: createdBy,
      snapshot,
    })
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!commit) throw new Error('Commit failed.');

  const pathMap = buildFilePathMap(files);
  const commitFiles = files
    .filter((f) => f.type === 'file')
    .map((file) => ({
      commit_id: commit.id,
      file_id: file.id,
      file_path: pathMap.get(file.id) || file.name,
      file_name: file.name,
      content: file.content ?? '',
    }));

  if (commitFiles.length > 0) {
    const { error: filesError } = await supabase
      .from('commit_files')
      .insert(commitFiles);
    if (filesError) throw filesError;
  }

  await supabase
    .from('repositories')
    .update({ last_updated: new Date().toISOString() })
    .eq('id', repositoryId);

  const workspaceId = await getRepositoryWorkspaceId(repositoryId);
  await logActivity({
    type: 'commit_created',
    actorId: createdBy,
    workspaceId,
    repositoryId,
    message: `Commit: ${message}`,
  });

  return commit;
}

/**
 * Get commit history with author info from profiles.
 * Falls back gracefully if profiles table doesn't have a FK relationship.
 */
export async function getCommitHistory(repositoryId) {
  // First try with profile join
  const { data, error } = await supabase
    .from('commits')
    .select('*')
    .eq('repository_id', repositoryId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  const commits = data ?? [];

  // Fetch user profiles for commit authors
  const userIds = [...new Set(commits.map(c => c.created_by).filter(Boolean))];
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    if (profiles) {
      const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
      commits.forEach(c => {
        const profile = profileMap[c.created_by];
        if (profile) {
          c.author_name = profile.full_name || profile.email?.split('@')[0] || 'Unknown';
          c.author_email = profile.email || '';
        }
      });
    }
  }

  return commits;
}

export async function getCommitFiles(commitId) {
  const { data, error } = await supabase
    .from('commit_files')
    .select('*')
    .eq('commit_id', commitId)
    .order('file_path', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Get commit details including the snapshot data.
 */
export async function getCommitById(commitId) {
  const { data, error } = await supabase
    .from('commits')
    .select('*')
    .eq('id', commitId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function restoreFileVersion({ fileId, commitId }) {
  const { data: commitFile, error: fetchError } = await supabase
    .from('commit_files')
    .select('*')
    .eq('commit_id', commitId)
    .eq('file_id', fileId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!commitFile) throw new Error('File version not found.');

  return updateFileContent({ fileId, content: commitFile.content ?? '' });
}

/**
 * Restore an entire repository to a specific commit snapshot.
 * Updates all files that exist in the snapshot to their committed content.
 * Returns the list of updated files.
 */
export async function restoreCommitSnapshot({ commitId, repositoryId, actorId = null }) {
  const commit = await getCommitById(commitId);
  if (!commit) throw new Error('Commit not found.');

  const snapshot = commit.snapshot || {};
  const fileIds = Object.keys(snapshot);
  if (fileIds.length === 0) throw new Error('No files in this commit snapshot.');

  const updatedFiles = [];

  for (const fileId of fileIds) {
    const { name, content } = snapshot[fileId];
    try {
      const updated = await updateFileContent({
        fileId,
        content: content ?? '',
        actorId,
      });
      if (updated) updatedFiles.push(updated);
    } catch {
      // File might have been deleted since the commit — skip it
    }
  }

  // Log the restore action
  const workspaceId = await getRepositoryWorkspaceId(repositoryId);
  await logActivity({
    type: 'commit_restored',
    actorId,
    workspaceId,
    repositoryId,
    message: `Restored to commit: "${commit.message}"`,
  });

  return updatedFiles;
}
