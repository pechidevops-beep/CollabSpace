-- Migration: 20261015000003_role_matrix_rls.sql
-- Description: Implement strict role matrix (owner, admin, contributor, viewer) and repo isolation
-- using app_private helper functions.

-- ============================================================================
-- 1. DROP INTERIM POLICIES FROM D2 ON MANAGED TABLES
-- ============================================================================

DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON public.workspaces;

DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete" ON public.workspace_members;

DROP POLICY IF EXISTS "repositories_select" ON public.repositories;
DROP POLICY IF EXISTS "repositories_insert" ON public.repositories;
DROP POLICY IF EXISTS "repositories_update" ON public.repositories;
DROP POLICY IF EXISTS "repositories_delete" ON public.repositories;

DROP POLICY IF EXISTS "repository_files_select" ON public.repository_files;
DROP POLICY IF EXISTS "repository_files_all" ON public.repository_files;

DROP POLICY IF EXISTS "branches_select" ON public.branches;
DROP POLICY IF EXISTS "branches_all" ON public.branches;

DROP POLICY IF EXISTS "commits_select" ON public.commits;
DROP POLICY IF EXISTS "commits_insert" ON public.commits;

DROP POLICY IF EXISTS "commit_files_select" ON public.commit_files;
DROP POLICY IF EXISTS "commit_files_insert" ON public.commit_files;

DROP POLICY IF EXISTS "pull_requests_select" ON public.pull_requests;
DROP POLICY IF EXISTS "pull_requests_insert" ON public.pull_requests;
DROP POLICY IF EXISTS "pull_requests_update" ON public.pull_requests;

DROP POLICY IF EXISTS "pull_request_comments_select" ON public.pull_request_comments;
DROP POLICY IF EXISTS "pull_request_comments_insert" ON public.pull_request_comments;

DROP POLICY IF EXISTS "repository_stars_select" ON public.repository_stars;
DROP POLICY IF EXISTS "repository_stars_insert" ON public.repository_stars;
DROP POLICY IF EXISTS "repository_stars_delete" ON public.repository_stars;

DROP POLICY IF EXISTS "assignments_select" ON public.assignments;
DROP POLICY IF EXISTS "assignments_insert" ON public.assignments;
DROP POLICY IF EXISTS "assignments_update" ON public.assignments;
DROP POLICY IF EXISTS "assignments_delete" ON public.assignments;

DROP POLICY IF EXISTS "submissions_select" ON public.submissions;
DROP POLICY IF EXISTS "submissions_insert" ON public.submissions;
DROP POLICY IF EXISTS "submissions_update" ON public.submissions;

DROP POLICY IF EXISTS "grades_select" ON public.grades;
DROP POLICY IF EXISTS "grades_all" ON public.grades;

DROP POLICY IF EXISTS "activities_select" ON public.activities;
DROP POLICY IF EXISTS "activities_insert" ON public.activities;

-- ============================================================================
-- 2. WORKSPACES
-- ============================================================================

-- Read workspace: all 4 roles (owner, admin, contributor, viewer)
CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(id, (SELECT auth.uid())));

-- Create workspace: owner_id must match authenticated user
CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- Edit workspace / regenerate join code: owner, admin
CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (app_private.is_workspace_role(id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid())));

-- Delete workspace: owner only
CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE TO authenticated
  USING (app_private.is_workspace_role(id, ARRAY['owner'::text], (SELECT auth.uid())));

-- ============================================================================
-- 3. WORKSPACE MEMBERS
-- ============================================================================

-- Read members: all 4 roles
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id, (SELECT auth.uid())));

-- Update member role: owner only, never to 'owner'
CREATE POLICY "workspace_members_update" ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (app_private.is_workspace_role(workspace_id, ARRAY['owner'::text], (SELECT auth.uid())))
  WITH CHECK (
    role <> 'owner'::text AND
    app_private.is_workspace_role(workspace_id, ARRAY['owner'::text], (SELECT auth.uid()))
  );

-- Remove member:
-- - Row with role 'owner' CANNOT be deleted (role <> 'owner')
-- - A non-owner can delete their own row (leave workspace)
-- - Owner can remove any non-owner member
-- - Admin can remove contributors and viewers
CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (
    role <> 'owner'::text AND (
      user_id = (SELECT auth.uid()) OR
      app_private.is_workspace_role(workspace_id, ARRAY['owner'::text], (SELECT auth.uid())) OR
      (
        app_private.is_workspace_role(workspace_id, ARRAY['admin'::text], (SELECT auth.uid())) AND
        role = ANY (ARRAY['contributor'::text, 'viewer'::text])
      )
    )
  );

-- ============================================================================
-- 4. REPOSITORIES & REPO-TIED OBJECTS
-- ============================================================================

-- Repositories
CREATE POLICY "repositories_select" ON public.repositories
  FOR SELECT TO authenticated
  USING (app_private.can_read_repo(id, (SELECT auth.uid())));

CREATE POLICY "repositories_insert" ON public.repositories
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid()) AND
    app_private.is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid()))
  );

CREATE POLICY "repositories_update" ON public.repositories
  FOR UPDATE TO authenticated
  USING (app_private.can_write_repo(id, (SELECT auth.uid())));

CREATE POLICY "repositories_delete" ON public.repositories
  FOR DELETE TO authenticated
  USING (app_private.is_workspace_role(workspace_id, ARRAY['owner'::text], (SELECT auth.uid())));

-- Repository Files
CREATE POLICY "repository_files_select" ON public.repository_files
  FOR SELECT TO authenticated
  USING (app_private.can_read_repo(repository_id, (SELECT auth.uid())));

CREATE POLICY "repository_files_insert" ON public.repository_files
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_write_repo(repository_id, (SELECT auth.uid())));

CREATE POLICY "repository_files_update" ON public.repository_files
  FOR UPDATE TO authenticated
  USING (app_private.can_write_repo(repository_id, (SELECT auth.uid())));

CREATE POLICY "repository_files_delete" ON public.repository_files
  FOR DELETE TO authenticated
  USING (app_private.can_write_repo(repository_id, (SELECT auth.uid())));

-- Branches
CREATE POLICY "branches_select" ON public.branches
  FOR SELECT TO authenticated
  USING (app_private.can_read_repo(repository_id, (SELECT auth.uid())));

CREATE POLICY "branches_insert" ON public.branches
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_write_repo(repository_id, (SELECT auth.uid())));

CREATE POLICY "branches_update" ON public.branches
  FOR UPDATE TO authenticated
  USING (app_private.can_write_repo(repository_id, (SELECT auth.uid())));

CREATE POLICY "branches_delete" ON public.branches
  FOR DELETE TO authenticated
  USING (app_private.can_write_repo(repository_id, (SELECT auth.uid())));

-- Commits
CREATE POLICY "commits_select" ON public.commits
  FOR SELECT TO authenticated
  USING (app_private.can_read_repo(repository_id, (SELECT auth.uid())));

CREATE POLICY "commits_insert" ON public.commits
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid()) AND
    app_private.can_write_repo(repository_id, (SELECT auth.uid()))
  );

-- Commit Files
CREATE POLICY "commit_files_select" ON public.commit_files
  FOR SELECT TO authenticated
  USING (
    app_private.can_read_repo(
      (SELECT c.repository_id FROM public.commits c WHERE c.id = commit_files.commit_id),
      (SELECT auth.uid())
    )
  );

CREATE POLICY "commit_files_insert" ON public.commit_files
  FOR INSERT TO authenticated
  WITH CHECK (
    app_private.can_write_repo(
      (SELECT c.repository_id FROM public.commits c WHERE c.id = commit_files.commit_id),
      (SELECT auth.uid())
    )
  );

-- Pull Requests
CREATE POLICY "pull_requests_select" ON public.pull_requests
  FOR SELECT TO authenticated
  USING (app_private.can_read_repo(repository_id, (SELECT auth.uid())));

CREATE POLICY "pull_requests_insert" ON public.pull_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid()) AND
    app_private.can_write_repo(repository_id, (SELECT auth.uid()))
  );

-- Pull request update: PR author or workspace owner/admin
CREATE POLICY "pull_requests_update" ON public.pull_requests
  FOR UPDATE TO authenticated
  USING (
    author_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = pull_requests.repository_id
        AND app_private.is_workspace_role(r.workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid()))
    )
  );

-- Pull Request Comments
CREATE POLICY "pull_request_comments_select" ON public.pull_request_comments
  FOR SELECT TO authenticated
  USING (
    app_private.can_read_repo(
      (SELECT pr.repository_id FROM public.pull_requests pr WHERE pr.id = pull_request_comments.pull_request_id),
      (SELECT auth.uid())
    )
  );

CREATE POLICY "pull_request_comments_insert" ON public.pull_request_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid()) AND
    app_private.can_write_repo(
      (SELECT pr.repository_id FROM public.pull_requests pr WHERE pr.id = pull_request_comments.pull_request_id),
      (SELECT auth.uid())
    )
  );

-- Repository Stars
CREATE POLICY "repository_stars_select" ON public.repository_stars
  FOR SELECT TO authenticated
  USING (app_private.can_read_repo(repository_id, (SELECT auth.uid())));

CREATE POLICY "repository_stars_insert" ON public.repository_stars
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    app_private.can_read_repo(repository_id, (SELECT auth.uid()))
  );

CREATE POLICY "repository_stars_delete" ON public.repository_stars
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- 5. ASSIGNMENTS, SUBMISSIONS & GRADES
-- ============================================================================

-- Assignments: all 4 roles read; owner and admin create/edit/delete
CREATE POLICY "assignments_select" ON public.assignments
  FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id, (SELECT auth.uid())));

CREATE POLICY "assignments_insert" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid()) AND
    app_private.is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid()))
  );

CREATE POLICY "assignments_update" ON public.assignments
  FOR UPDATE TO authenticated
  USING (app_private.is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid())));

CREATE POLICY "assignments_delete" ON public.assignments
  FOR DELETE TO authenticated
  USING (app_private.is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid())));

-- Submissions:
-- Student reads own; owner/admin reads all for that assignment's workspace
CREATE POLICY "submissions_select" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    (student_id = (SELECT auth.uid())) OR
    (EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND app_private.is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid()))
    ))
  );

-- Submit: contributor only, for themselves, only to assignments in their workspace
CREATE POLICY "submissions_insert" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND app_private.is_workspace_role(a.workspace_id, ARRAY['contributor'::text], (SELECT auth.uid()))
    )
  );

-- Update submission: student (own) or staff (owner/admin)
CREATE POLICY "submissions_update" ON public.submissions
  FOR UPDATE TO authenticated
  USING (
    (student_id = (SELECT auth.uid())) OR
    (EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND app_private.is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid()))
    ))
  );

-- Grades:
-- Read: student (own submission) or staff (owner/admin)
CREATE POLICY "grades_select" ON public.grades
  FOR SELECT TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = grades.submission_id AND s.student_id = (SELECT auth.uid())
    )) OR
    (EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = grades.submission_id
        AND app_private.is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid()))
    ))
  );

-- Write (insert/update/delete): owner or admin only
CREATE POLICY "grades_all" ON public.grades
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = grades.submission_id
        AND app_private.is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = grades.submission_id
        AND app_private.is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid()))
    )
  );

-- ============================================================================
-- 6. ACTIVITIES
-- ============================================================================

-- Read activity: all 4 roles of that workspace
CREATE POLICY "activities_select" ON public.activities
  FOR SELECT TO authenticated
  USING (
    workspace_id IS NOT NULL AND
    app_private.is_workspace_member(workspace_id, (SELECT auth.uid()))
  );

-- Insert activity: actor must be the authenticated user and a member of workspace_id
CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = (SELECT auth.uid()) AND
    workspace_id IS NOT NULL AND
    app_private.is_workspace_member(workspace_id, (SELECT auth.uid()))
  );
