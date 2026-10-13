import { supabase } from '../lib/supabaseClient';

async function refreshStarsCount(repositoryId) {
  const { count, error } = await supabase
    .from('repository_stars')
    .select('id', { count: 'exact', head: true })
    .eq('repository_id', repositoryId);
  if (error) throw error;

  const { error: updateError } = await supabase
    .from('repositories')
    .update({ stars_count: count ?? 0, last_updated: new Date().toISOString() })
    .eq('id', repositoryId);
  if (updateError) throw updateError;

  return count ?? 0;
}

export async function getUserStar(repositoryId, userId) {
  const { data, error } = await supabase
    .from('repository_stars')
    .select('id')
    .eq('repository_id', repositoryId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function starRepository(repositoryId, userId) {
  const { error } = await supabase
    .from('repository_stars')
    .upsert({ repository_id: repositoryId, user_id: userId }, { onConflict: 'repository_id,user_id' });
  if (error) throw error;
  return refreshStarsCount(repositoryId);
}

export async function unstarRepository(repositoryId, userId) {
  const { error } = await supabase
    .from('repository_stars')
    .delete()
    .eq('repository_id', repositoryId)
    .eq('user_id', userId);
  if (error) throw error;
  return refreshStarsCount(repositoryId);
}
