import { supabase } from '../lib/supabaseClient';

export async function getCommitFiles(commitId) {
  const { data, error } = await supabase
    .from('commit_files')
    .select('*')
    .eq('commit_id', commitId)
    .order('file_path', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addCommitFiles(commitId, repositoryId, files = []) {
  if (!files.length) return [];
  const payload = files.map((f) => ({
    commit_id: commitId,
    repository_id: repositoryId,
    file_path: f.file_path,
    change_type: f.change_type,
    diff: f.diff ?? null,
  }));

  const { data, error } = await supabase
    .from('commit_files')
    .insert(payload)
    .select('*');
  if (error) throw error;
  return data ?? [];
}
