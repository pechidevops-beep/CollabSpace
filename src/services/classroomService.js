import { supabase } from '../lib/supabaseClient';
import { logActivity } from './activityService';
import { createNotification } from './notificationService';

export async function getAssignments(workspaceId) {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAssignmentById(assignmentId) {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', assignmentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createAssignment({
  workspaceId,
  title,
  description = null,
  dueDate = null,
  createdBy,
  maxPoints = 100,
}) {
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      workspace_id: workspaceId,
      title,
      description,
      due_date: dueDate,
      created_by: createdBy,
      max_points: maxPoints,
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;

  await logActivity({
    type: 'assignment_created',
    actorId: createdBy,
    workspaceId,
    assignmentId: data?.id,
    message: `Assignment "${title}" was created.`,
  });

  return data;
}

export async function deleteAssignment(assignmentId) {
  const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
  if (error) throw error;
}

export async function getSubmissions(assignmentId) {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch submissions with student profile info (name, email).
 */
export async function getSubmissionsWithProfiles(assignmentId) {
  const submissions = await getSubmissions(assignmentId);
  if (submissions.length === 0) return [];

  const studentIds = [...new Set(submissions.map(s => s.student_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', studentIds);

  const profileMap = {};
  (profiles ?? []).forEach(p => { profileMap[p.id] = p; });

  return submissions.map(s => ({
    ...s,
    student_name: profileMap[s.student_id]?.full_name || 'Unknown',
    student_email: profileMap[s.student_id]?.email || '',
  }));
}

export async function getUserSubmission(assignmentId, studentId) {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitWork({
  assignmentId,
  studentId,
  repositoryId,
}) {
  const assignment = await getAssignmentById(assignmentId);
  const existing = await getUserSubmission(assignmentId, studentId);
  if (existing) {
    const { data, error } = await supabase
      .from('submissions')
      .update({
        repository_id: repositoryId,
        submitted_at: new Date().toISOString(),
        status: 'submitted',
      })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('submissions')
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      repository_id: repositoryId,
      status: 'submitted',
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;

  await logActivity({
    type: 'submission_created',
    actorId: studentId,
    workspaceId: assignment?.workspace_id ?? null,
    assignmentId,
    message: 'A submission was created.',
  });

  return data;
}

export async function gradeSubmission({
  submissionId,
  grade,
  feedback = null,
  graderId = null,
}) {
  const { data, error } = await supabase
    .from('submissions')
    .update({ grade, feedback, status: 'reviewed' })
    .eq('id', submissionId)
    .select('*')
    .maybeSingle();
  if (error) throw error;

  await supabase
    .from('grades')
    .upsert({
      submission_id: submissionId,
      grade,
      feedback,
      grader_id: graderId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'submission_id' });

  // Notify student
  if (data?.student_id) {
    createNotification({
      userId: data.student_id,
      workspaceId: null,
      type: 'grade_received',
      title: `Your submission received a grade: ${grade}`,
      message: feedback || null,
    }).catch(() => { });
  }

  return data;
}

/**
 * Update submission status (e.g., return for revision).
 */
export async function updateSubmissionStatus({ submissionId, status }) {
  const validStatuses = ['pending', 'submitted', 'reviewed', 'returned'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  const { data, error } = await supabase
    .from('submissions')
    .update({ status })
    .eq('id', submissionId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Get per-assignment submission stats.
 */
export async function getAssignmentStats(assignmentId) {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, status, grade')
    .eq('assignment_id', assignmentId);
  if (error) throw error;

  const subs = data ?? [];
  return {
    total: subs.length,
    submitted: subs.filter(s => s.status === 'submitted').length,
    reviewed: subs.filter(s => s.status === 'reviewed').length,
    returned: subs.filter(s => s.status === 'returned').length,
    pending: subs.filter(s => s.status === 'pending').length,
    averageGrade: subs.filter(s => s.grade != null).length > 0
      ? subs.filter(s => s.grade != null).reduce((sum, s) => sum + Number(s.grade), 0) / subs.filter(s => s.grade != null).length
      : null,
  };
}

