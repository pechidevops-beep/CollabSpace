import { supabase } from '../lib/supabaseClient';
import { logActivity } from './activityService';

export async function getPullRequests(repositoryId) {
  const { data, error } = await supabase
    .from('pull_requests')
    .select('*')
    .eq('repository_id', repositoryId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPullRequest({
  repositoryId,
  sourceBranch,
  targetBranch = 'main',
  title,
  description = null,
  authorId = null,
}) {
  const { data, error } = await supabase
    .from('pull_requests')
    .insert({
      repository_id: repositoryId,
      source_branch: sourceBranch,
      target_branch: targetBranch,
      title,
      description,
      author_id: authorId,
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;

  await logActivity({
    type: 'pr_created',
    actorId: authorId,
    repositoryId,
    message: `Pull request "${title}" was created.`,
  });

  return data;
}

export async function updatePullRequestStatus({
  pullRequestId,
  status,
  mergedBy = null,
}) {
  const patch = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'merged') {
    patch.merged_by = mergedBy;
    patch.merged_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('pull_requests')
    .update(patch)
    .eq('id', pullRequestId)
    .select('*')
    .maybeSingle();
  if (error) throw error;

  await logActivity({
    type: status === 'merged' ? 'pr_merged' : 'pr_updated',
    actorId: mergedBy,
    repositoryId: data?.repository_id ?? null,
    message: `Pull request "${data?.title ?? 'PR'}" status: ${status}.`,
  });

  return data;
}

export async function addPullRequestComment({
  pullRequestId,
  authorId = null,
  comment,
}) {
  const { data, error } = await supabase
    .from('pull_request_comments')
    .insert({
      pull_request_id: pullRequestId,
      author_id: authorId,
      comment,
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;

  return data;
}

export async function getPullRequestComments(pullRequestId) {
  const { data, error } = await supabase
    .from('pull_request_comments')
    .select('*')
    .eq('pull_request_id', pullRequestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
