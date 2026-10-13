import { supabase } from '../lib/supabaseClient';
import { logActivity } from './activityService';

export async function getBranches(repositoryId) {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('repository_id', repositoryId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createBranch({
  repositoryId,
  name,
  createdBy = null,
}) {
  const { data, error } = await supabase
    .from('branches')
    .insert({
      repository_id: repositoryId,
      name,
      created_by: createdBy,
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;

  await logActivity({
    type: 'branch_created',
    actorId: createdBy,
    repositoryId,
    message: `Branch "${name}" was created.`,
  });

  return data;
}

export async function deleteBranch({ branchId, actorId = null }) {
  const { data: branch, error: fetchError } = await supabase
    .from('branches')
    .select('id, name, repository_id')
    .eq('id', branchId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const { error } = await supabase.from('branches').delete().eq('id', branchId);
  if (error) throw error;

  if (branch?.repository_id) {
    await logActivity({
      type: 'branch_deleted',
      actorId,
      repositoryId: branch.repository_id,
      message: `Branch "${branch.name}" was deleted.`,
    });
  }
}
