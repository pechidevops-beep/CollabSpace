-- Migration: 20261015000001_security_lockdown.sql
-- Description: Revoke permissions from anon, strip dangerous permissions from authenticated,
-- drop duplicate and 'true' policies, and enforce TO authenticated on all policies.

-- ============================================================================
-- 1. REVOKE PRIVILEGES FROM anon & DANGEROUS PRIVILEGES FROM authenticated
-- ============================================================================

-- Revoke all access from anon on tables, sequences, functions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

-- Revoke TRUNCATE, REFERENCES, TRIGGER from authenticated
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Ensure future objects do not grant these automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;

-- Explicitly grant standard DML permissions to authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- 2. DROP ALL EXISTING POLICIES (TO PUBLIC, DUPLICATES, AND 'TRUE' POLICIES)
-- ============================================================================

-- activities
DROP POLICY IF EXISTS "activities_insert" ON public.activities;
DROP POLICY IF EXISTS "activities_select" ON public.activities;

-- assignments
DROP POLICY IF EXISTS "assignments_insert" ON public.assignments;
DROP POLICY IF EXISTS "assignments_select" ON public.assignments;

-- branches
DROP POLICY IF EXISTS "branches_all" ON public.branches;

-- classrooms
DROP POLICY IF EXISTS "classrooms_all" ON public.classrooms;
DROP POLICY IF EXISTS "classrooms_select" ON public.classrooms;

-- commit_files
DROP POLICY IF EXISTS "commit_files_all" ON public.commit_files;
DROP POLICY IF EXISTS "commit_files_insert" ON public.commit_files;
DROP POLICY IF EXISTS "commit_files_select" ON public.commit_files;

-- commits
DROP POLICY IF EXISTS "commits_insert" ON public.commits;
DROP POLICY IF EXISTS "commits_select" ON public.commits;

-- grades
DROP POLICY IF EXISTS "grades_select" ON public.grades;
DROP POLICY IF EXISTS "grades_upsert" ON public.grades;

-- notifications
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

-- profiles
DROP POLICY IF EXISTS "Profiles: users can insert own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: users can read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: users can update own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- pull_request_comments
DROP POLICY IF EXISTS "pull_request_comments_all" ON public.pull_request_comments;

-- pull_requests
DROP POLICY IF EXISTS "pull_requests_all" ON public.pull_requests;

-- repo_files
DROP POLICY IF EXISTS "repo_files_members_insert" ON public.repo_files;
DROP POLICY IF EXISTS "repo_files_members_read" ON public.repo_files;
DROP POLICY IF EXISTS "repo_files_members_update" ON public.repo_files;

-- repositories
DROP POLICY IF EXISTS "repositories_delete" ON public.repositories;
DROP POLICY IF EXISTS "repositories_insert" ON public.repositories;
DROP POLICY IF EXISTS "repositories_members_read" ON public.repositories;
DROP POLICY IF EXISTS "repositories_owner_insert" ON public.repositories;
DROP POLICY IF EXISTS "repositories_select" ON public.repositories;
DROP POLICY IF EXISTS "repositories_update" ON public.repositories;

-- repository_files
DROP POLICY IF EXISTS "repository_files_select" ON public.repository_files;
DROP POLICY IF EXISTS "repository_files_write" ON public.repository_files;

-- repository_stars
DROP POLICY IF EXISTS "repository_stars_all" ON public.repository_stars;

-- submissions
DROP POLICY IF EXISTS "submissions_insert" ON public.submissions;
DROP POLICY IF EXISTS "submissions_select" ON public.submissions;
DROP POLICY IF EXISTS "submissions_update" ON public.submissions;

-- workspace_members
DROP POLICY IF EXISTS "workspace_members_delete" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_self" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_select_own" ON public.workspace_members;

-- workspaces
DROP POLICY IF EXISTS "Anyone authenticated can read workspaces to join" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_owners" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_members_read" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_owner_all" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;

-- ============================================================================
-- 3. RECREATE RESTRICTED POLICIES TARGETING `authenticated` ONLY
-- ============================================================================

-- profiles: authenticated users can read profiles (needed for workspace member display), insert and update own
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- workspaces: select if member, insert if owner, update/delete if owner
CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT TO authenticated
  USING (is_workspace_member(id, (SELECT auth.uid())));

CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (is_workspace_role(id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid())));

CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE TO authenticated
  USING (is_workspace_role(id, ARRAY['owner'::text], (SELECT auth.uid())));

-- workspace_members: select if member of workspace
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())));

CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid())));

-- notifications: own only
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- activities: select if workspace member, insert own
CREATE POLICY "activities_select" ON public.activities
  FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id, (SELECT auth.uid())));

CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = (SELECT auth.uid()) AND
    (workspace_id IS NULL OR is_workspace_member(workspace_id, (SELECT auth.uid())))
  );

-- assignments: select if workspace member
CREATE POLICY "assignments_select" ON public.assignments
  FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())));

CREATE POLICY "assignments_insert" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid())));

CREATE POLICY "assignments_update" ON public.assignments
  FOR UPDATE TO authenticated
  USING (is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid())));

CREATE POLICY "assignments_delete" ON public.assignments
  FOR DELETE TO authenticated
  USING (is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid())));

-- submissions: select if student or staff
CREATE POLICY "submissions_select" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    (student_id = (SELECT auth.uid())) OR
    (EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid()))
    ))
  );

CREATE POLICY "submissions_insert" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    (student_id = (SELECT auth.uid())) AND
    (EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND is_workspace_member(a.workspace_id, (SELECT auth.uid()))
    ))
  );

CREATE POLICY "submissions_update" ON public.submissions
  FOR UPDATE TO authenticated
  USING (
    (student_id = (SELECT auth.uid())) OR
    (EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid()))
    ))
  );

-- grades: select if student or staff, write if staff
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
        AND is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid()))
    ))
  );

CREATE POLICY "grades_all" ON public.grades
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = grades.submission_id
        AND is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = grades.submission_id
        AND is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid()))
    )
  );

-- repositories: select if member, insert if member, update/delete if staff
CREATE POLICY "repositories_select" ON public.repositories
  FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())));

CREATE POLICY "repositories_insert" ON public.repositories
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid()) AND
    is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid()))
  );

CREATE POLICY "repositories_update" ON public.repositories
  FOR UPDATE TO authenticated
  USING (is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid())));

CREATE POLICY "repositories_delete" ON public.repositories
  FOR DELETE TO authenticated
  USING (is_workspace_role(workspace_id, ARRAY['owner'::text], (SELECT auth.uid())));

-- repository_files: member read, contributor/admin/owner write
CREATE POLICY "repository_files_select" ON public.repository_files
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = repository_files.repository_id
        AND is_workspace_member(r.workspace_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "repository_files_all" ON public.repository_files
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = repository_files.repository_id
        AND is_workspace_role(r.workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = repository_files.repository_id
        AND is_workspace_role(r.workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid()))
    )
  );

-- branches
CREATE POLICY "branches_select" ON public.branches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = branches.repository_id
        AND is_workspace_member(r.workspace_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "branches_all" ON public.branches
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = branches.repository_id
        AND is_workspace_role(r.workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = branches.repository_id
        AND is_workspace_role(r.workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid()))
    )
  );

-- commits
CREATE POLICY "commits_select" ON public.commits
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = commits.repository_id
        AND is_workspace_member(r.workspace_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "commits_insert" ON public.commits
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = commits.repository_id
        AND is_workspace_role(r.workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid()))
    )
  );

-- commit_files
CREATE POLICY "commit_files_select" ON public.commit_files
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commits c
      JOIN public.repositories r ON r.id = c.repository_id
      WHERE c.id = commit_files.commit_id
        AND is_workspace_member(r.workspace_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "commit_files_insert" ON public.commit_files
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.commits c
      JOIN public.repositories r ON r.id = c.repository_id
      WHERE c.id = commit_files.commit_id
        AND is_workspace_role(r.workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid()))
    )
  );

-- pull_requests
CREATE POLICY "pull_requests_select" ON public.pull_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = pull_requests.repository_id
        AND is_workspace_member(r.workspace_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "pull_requests_insert" ON public.pull_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = pull_requests.repository_id
        AND is_workspace_role(r.workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid()))
    )
  );

CREATE POLICY "pull_requests_update" ON public.pull_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = pull_requests.repository_id
        AND is_workspace_role(r.workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid()))
    )
  );

-- pull_request_comments
CREATE POLICY "pull_request_comments_select" ON public.pull_request_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pull_requests pr
      JOIN public.repositories r ON r.id = pr.repository_id
      WHERE pr.id = pull_request_comments.pull_request_id
        AND is_workspace_member(r.workspace_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "pull_request_comments_insert" ON public.pull_request_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.pull_requests pr
      JOIN public.repositories r ON r.id = pr.repository_id
      WHERE pr.id = pull_request_comments.pull_request_id
        AND is_workspace_role(r.workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid()))
    )
  );

-- repository_stars
CREATE POLICY "repository_stars_select" ON public.repository_stars
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = repository_stars.repository_id
        AND is_workspace_member(r.workspace_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "repository_stars_insert" ON public.repository_stars
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.repositories r
      WHERE r.id = repository_stars.repository_id
        AND is_workspace_member(r.workspace_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "repository_stars_delete" ON public.repository_stars
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
