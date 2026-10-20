-- ============================================================================
-- SUPABASE PHASE D: COMPLETE LIVE MIGRATION BUNDLE (ALL-OR-NOTHING)
-- ============================================================================
-- Execution: Run this entire script in Supabase SQL Editor for your LIVE project.
-- Prerequisite 1: Take manual backups (BOTH schema DDL and --data-only) using IPv4 Session Pooler:
--   npx supabase db dump --db-url "postgresql://postgres.<REF>:<ENC_PASS>@aws-0-<REGION>.pooler.supabase.com:5432/postgres" -f schema_backup.sql
--   npx supabase db dump --data-only --use-copy --db-url "postgresql://postgres.<REF>:<ENC_PASS>@aws-0-<REGION>.pooler.supabase.com:5432/postgres" -f data_backup.sql
--   (Note: Password special characters must be URL-encoded; default dump is schema DDL, not "roles and schema")
-- Prerequisite 2: Run supabase/preflight_live.sql to verify existing data.
-- ============================================================================

BEGIN;

-- >>> START OF supabase/migrations/20261015000001_security_lockdown.sql <<<
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
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
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

-- profiles: own-row only. Other users' names come from list_workspace_members RPC.
-- No policy allows reading other users' email.
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

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


-- >>> START OF supabase/migrations/20261015000002_security_helpers.sql <<<
-- Migration: 20261015000002_security_helpers.sql
-- Description: Implement security definer helper functions in private schema with search_path = ''
-- and tighten existing functions.

-- ============================================================================
-- 1. CREATE PRIVATE SCHEMA
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS app_private;

REVOKE ALL ON SCHEMA app_private FROM public, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;

-- ============================================================================
-- 2. HELPER FUNCTIONS IN app_private
-- ============================================================================

-- Get member role in workspace
CREATE OR REPLACE FUNCTION app_private.workspace_role(
  _workspace_id UUID,
  _user_id UUID DEFAULT auth.uid()
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT wm.role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = _workspace_id
    AND wm.user_id = _user_id
  LIMIT 1;
$$;

-- Check if user is member of workspace
CREATE OR REPLACE FUNCTION app_private.is_workspace_member(
  _workspace_id UUID,
  _user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _user_id
  );
$$;

-- Check if user has one of the specified roles in workspace
CREATE OR REPLACE FUNCTION app_private.is_workspace_role(
  _workspace_id UUID,
  _roles TEXT[],
  _user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _user_id
      AND wm.role = ANY (_roles)
  );
$$;

-- Helper: can user read repository?
-- Rules:
-- team workspace: all 4 roles (owner, admin, contributor, viewer) read all repos
-- classroom workspace: contributor reads only repos they created; owner and admin read all; viewer none
CREATE OR REPLACE FUNCTION app_private.can_read_repo(
  _repo_id UUID,
  _user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_workspace_id UUID;
  v_created_by UUID;
  v_ws_type TEXT;
  v_role TEXT;
BEGIN
  IF _repo_id IS NULL OR _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT r.workspace_id, r.created_by, w.type, wm.role
  INTO v_workspace_id, v_created_by, v_ws_type, v_role
  FROM public.repositories r
  JOIN public.workspaces w ON w.id = r.workspace_id
  JOIN public.workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = _user_id
  WHERE r.id = _repo_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_ws_type = 'team' THEN
    RETURN v_role = ANY (ARRAY['owner'::text, 'admin'::text, 'contributor'::text, 'viewer'::text]);
  ELSIF v_ws_type = 'classroom' THEN
    IF v_role = ANY (ARRAY['owner'::text, 'admin'::text]) THEN
      RETURN TRUE;
    ELSIF v_role = 'contributor' THEN
      RETURN v_created_by = _user_id;
    ELSE
      RETURN FALSE;
    END IF;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

-- Helper: can user write repository?
-- Rules:
-- team workspace: owner, admin, contributor write; viewer read-only
-- classroom workspace: contributor writes only repos they created; owner and admin write; viewer none
CREATE OR REPLACE FUNCTION app_private.can_write_repo(
  _repo_id UUID,
  _user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_workspace_id UUID;
  v_created_by UUID;
  v_ws_type TEXT;
  v_role TEXT;
BEGIN
  IF _repo_id IS NULL OR _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT r.workspace_id, r.created_by, w.type, wm.role
  INTO v_workspace_id, v_created_by, v_ws_type, v_role
  FROM public.repositories r
  JOIN public.workspaces w ON w.id = r.workspace_id
  JOIN public.workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = _user_id
  WHERE r.id = _repo_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_ws_type = 'team' THEN
    RETURN v_role = ANY (ARRAY['owner'::text, 'admin'::text, 'contributor'::text]);
  ELSIF v_ws_type = 'classroom' THEN
    IF v_role = ANY (ARRAY['owner'::text, 'admin'::text]) THEN
      RETURN TRUE;
    ELSIF v_role = 'contributor' THEN
      RETURN v_created_by = _user_id;
    ELSE
      RETURN FALSE;
    END IF;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

-- ============================================================================
-- 3. HARDEN EXISTING FUNCTIONS (search_path = '' & REVOKE FROM public, anon)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = coalesce(excluded.email, public.profiles.email);
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.set_repo_files_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Revoke execution from public & anon
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.set_repo_files_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_repo_files_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_workspace_role(uuid, text[], uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_workspace_role(uuid, text[], uuid) FROM anon;

-- Grant execution on app_private helpers to authenticated only
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO authenticated;

-- Ensure future functions in app_private do not inherit execute for PUBLIC or anon
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private GRANT EXECUTE ON FUNCTIONS TO authenticated;


-- >>> START OF supabase/migrations/20261015000003_role_matrix_rls.sql <<<
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


-- >>> START OF supabase/migrations/20261015000004_rpcs_and_triggers.sql <<<
-- Migration: 20261015000004_rpcs_and_triggers.sql
-- Description: Implement security definer RPCs (join_workspace, list_workspace_members,
-- notify_workspace_members) and triggers (workspace creator trigger, submissions validation).

-- ============================================================================
-- 1. WORKSPACE CREATOR TRIGGER (AUTO-ADD OWNER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_workspace_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new.id, new.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS tr_workspace_created ON public.workspaces;
CREATE TRIGGER tr_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_workspace_created();

-- Ensure self-insert policies on workspace_members are removed
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_self" ON public.workspace_members;

-- ============================================================================
-- 2. SQL JOIN CODE GENERATOR & REGENERATION
-- ============================================================================

-- Join code generator:
-- Alphabet (32 chars): '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
-- Confusable characters omitted: '0' (zero), 'O' (letter O), '1' (one), 'I' (letter I)
-- Code format: 'TEAM-XXXXXXXX' (8 random characters from alphabet)
-- Entropy calculation:
--   - Alphabet length: N = 32 (5 bits per character)
--   - Code length: k = 8 characters
--   - Bits of entropy = 8 * log2(32) = 8 * 5 = 40.0 bits
--   - Total unique combinations: 32^8 = 1,099,511,627,776 (> 1.099 trillion)
--   - Randomness source: extensions.gen_random_bytes(8) (cryptographically secure)
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code text;
  v_rand bytea;
  v_i int;
  v_idx int;
BEGIN
  LOOP
    v_code := 'TEAM-';
    v_rand := extensions.gen_random_bytes(8);
    FOR v_i IN 0..7 LOOP
      v_idx := (get_byte(v_rand, v_i) % length(v_chars)) + 1;
      v_code := v_code || substr(v_chars, v_idx, 1);
    END LOOP;
    -- Ensure uniqueness across workspaces
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE join_code = v_code) THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.workspaces ALTER COLUMN join_code SET DEFAULT public.generate_join_code();

-- Rate-limiting table for join and regeneration attempts (Item 4 & 5)
CREATE TABLE IF NOT EXISTS public.join_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'join',
  ip INET,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.join_attempts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.join_attempts ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'join';
ALTER TABLE public.join_attempts ADD COLUMN IF NOT EXISTS ip INET;

DROP INDEX IF EXISTS public.idx_join_attempts_user_time;
DROP INDEX IF EXISTS public.idx_join_attempts_user_action_time;
CREATE INDEX IF NOT EXISTS idx_join_attempts_user_action_time ON public.join_attempts (user_id, action, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_join_attempts_ip_action_time ON public.join_attempts (ip, action, attempted_at DESC) WHERE ip IS NOT NULL;

-- Enable RLS and revoke all client access from anon and authenticated (Item 5)
ALTER TABLE public.join_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.join_attempts FROM anon, authenticated;

-- BEFORE INSERT trigger that overrides any client-supplied join_code (Item 3)
CREATE OR REPLACE FUNCTION public.enforce_workspace_join_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.join_code := public.generate_join_code();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_workspace_join_code ON public.workspaces;
CREATE TRIGGER tr_enforce_workspace_join_code
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_workspace_join_code();

-- Regenerate ALL existing join codes with high-entropy SQL generator
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.workspaces LOOP
    UPDATE public.workspaces
    SET join_code = public.generate_join_code()
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- Rate-limited join_code regeneration RPC (owner/admin only) (Item 4)
CREATE OR REPLACE FUNCTION public.regenerate_join_code(workspace_id UUID)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_recent_user_attempts INT;
  v_recent_ip_attempts INT;
  v_new_code TEXT;
  v_raw_ip TEXT;
  v_headers JSON;
  v_ip INET := NULL;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Extract client IP from request.headers if present (PostgREST), safely handling null/missing headers
  BEGIN
    v_raw_ip := current_setting('request.headers', true);
    IF v_raw_ip IS NOT NULL AND v_raw_ip <> '' THEN
      v_headers := v_raw_ip::json;
      v_raw_ip := coalesce(
        v_headers->>'cf-connecting-ip',
        split_part(v_headers->>'x-forwarded-for', ',', 1),
        v_headers->>'x-real-ip'
      );
      IF v_raw_ip IS NOT NULL AND trim(v_raw_ip) <> '' THEN
        v_ip := trim(v_raw_ip)::inet;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  -- 1. Rate limiting: max 10 failed regenerations per 10 minutes per user
  SELECT count(*)
  INTO v_recent_user_attempts
  FROM public.join_attempts
  WHERE user_id = v_caller_id
    AND action = 'regenerate'
    AND attempted_at > (now() - interval '10 minutes');

  IF v_recent_user_attempts >= 10 THEN
    RAISE EXCEPTION 'Too many join code requests. Please try again later.';
  END IF;

  -- Secondary generous IP rate limit (100 attempts / 10 min) when IP is available
  IF v_ip IS NOT NULL THEN
    SELECT count(*)
    INTO v_recent_ip_attempts
    FROM public.join_attempts
    WHERE ip = v_ip
      AND action = 'regenerate'
      AND attempted_at > (now() - interval '10 minutes');

    IF v_recent_ip_attempts >= 100 THEN
      RAISE EXCEPTION 'Too many join code requests from this network. Please try again later.';
    END IF;
  END IF;

  -- 2. Check permissions (owner or admin only)
  SELECT wm.role INTO v_caller_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = regenerate_join_code.workspace_id
    AND wm.user_id = v_caller_id;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    -- Log failed regeneration attempt (unauthorized caller)
    INSERT INTO public.join_attempts (user_id, action, ip, attempted_at)
    VALUES (v_caller_id, 'regenerate', v_ip, now());

    RAISE EXCEPTION 'Permission denied. Only owners and admins can regenerate join codes.';
  END IF;

  -- 3. Generate new code and update workspace with authorization flag
  -- Note: Successful regenerations do NOT log into join_attempts (count only failed attempts)
  v_new_code := public.generate_join_code();
  PERFORM set_config('app.allow_join_code_regen', 'true', true);

  UPDATE public.workspaces
  SET join_code = v_new_code
  WHERE id = regenerate_join_code.workspace_id;

  -- 4. Log activity
  INSERT INTO public.activities (type, actor_id, workspace_id, message)
  VALUES ('join_code_regenerated', v_caller_id, regenerate_join_code.workspace_id, 'Workspace join code was regenerated.');

  RETURN v_new_code;
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_join_code(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.regenerate_join_code(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.regenerate_join_code(UUID) TO authenticated;

-- ============================================================================
-- 3. RATE-LIMITED JOIN WORKSPACE RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.join_workspace(code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_clean_code TEXT;
  v_recent_user_attempts INT;
  v_recent_ip_attempts INT;
  v_workspace RECORD;
  v_member_id UUID;
  v_raw_ip TEXT;
  v_headers JSON;
  v_ip INET := NULL;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Extract client IP from request.headers if present (PostgREST), safely handling null/missing headers
  BEGIN
    v_raw_ip := current_setting('request.headers', true);
    IF v_raw_ip IS NOT NULL AND v_raw_ip <> '' THEN
      v_headers := v_raw_ip::json;
      v_raw_ip := coalesce(
        v_headers->>'cf-connecting-ip',
        split_part(v_headers->>'x-forwarded-for', ',', 1),
        v_headers->>'x-real-ip'
      );
      IF v_raw_ip IS NOT NULL AND trim(v_raw_ip) <> '' THEN
        v_ip := trim(v_raw_ip)::inet;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  -- 0. Clean up join attempts older than 1 day
  DELETE FROM public.join_attempts
  WHERE attempted_at < (now() - interval '1 day');

  -- 1. Rate limit: max 10 failed attempts per 10 minutes per user (tracked separately via action = 'join')
  SELECT count(*)
  INTO v_recent_user_attempts
  FROM public.join_attempts
  WHERE user_id = v_user_id
    AND action = 'join'
    AND attempted_at > (now() - interval '10 minutes');

  IF v_recent_user_attempts >= 10 THEN
    RAISE EXCEPTION 'Too many join attempts. Please try again later.';
  END IF;

  -- Secondary generous limit per IP (100 attempts / 10 min) to accommodate shared classroom NATs
  IF v_ip IS NOT NULL THEN
    SELECT count(*)
    INTO v_recent_ip_attempts
    FROM public.join_attempts
    WHERE ip = v_ip
      AND action = 'join'
      AND attempted_at > (now() - interval '10 minutes');

    IF v_recent_ip_attempts >= 100 THEN
      RAISE EXCEPTION 'Too many join attempts from this network. Please try again later.';
    END IF;
  END IF;

  -- 2. Validate format and lookup workspace
  v_clean_code := upper(trim(code));
  IF v_clean_code IS NULL OR length(v_clean_code) < 5 THEN
    INSERT INTO public.join_attempts (user_id, action, ip, attempted_at)
    VALUES (v_user_id, 'join', v_ip, now());
    RAISE EXCEPTION 'Invalid workspace code.';
  END IF;

  SELECT id, name, owner_id
  INTO v_workspace
  FROM public.workspaces
  WHERE join_code = v_clean_code;

  -- Identical error message for wrong, non-existent, or expired code
  IF NOT FOUND THEN
    INSERT INTO public.join_attempts (user_id, action, ip, attempted_at)
    VALUES (v_user_id, 'join', v_ip, now());
    RAISE EXCEPTION 'Invalid workspace code.';
  END IF;

  IF v_workspace.owner_id = v_user_id THEN
    INSERT INTO public.join_attempts (user_id, action, ip, attempted_at)
    VALUES (v_user_id, 'join', v_ip, now());
    RAISE EXCEPTION 'You are the owner of this workspace already.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_workspace.id AND user_id = v_user_id
  ) THEN
    INSERT INTO public.join_attempts (user_id, action, ip, attempted_at)
    VALUES (v_user_id, 'join', v_ip, now());
    RAISE EXCEPTION 'You are already a member of this workspace.';
  END IF;

  -- 3. Insert contributor role only (SUCCESS - does NOT insert into join_attempts)
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace.id, v_user_id, 'contributor')
  RETURNING id INTO v_member_id;

  -- 4. Log activity
  INSERT INTO public.activities (type, actor_id, workspace_id, message)
  VALUES ('workspace_joined', v_user_id, v_workspace.id, 'A member joined workspace "' || v_workspace.name || '".');

  RETURN jsonb_build_object(
    'workspace_id', v_workspace.id,
    'workspace_name', v_workspace.name,
    'role', 'contributor'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_workspace(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_workspace(text) TO authenticated;

-- ============================================================================
-- 4. LIST WORKSPACE MEMBERS RPC (EMAIL ONLY FOR OWNER/ADMIN)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_workspace_members(workspace_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  role TEXT,
  joined_date TIMESTAMPTZ,
  email TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT wm.role INTO v_caller_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = list_workspace_members.workspace_id
    AND wm.user_id = v_caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access denied. You are not a member of this workspace.';
  END IF;

  IF v_caller_role = ANY (ARRAY['owner'::text, 'admin'::text]) THEN
    -- Return member profiles WITH email
    RETURN QUERY
    SELECT
      wm.user_id,
      p.full_name,
      wm.role,
      wm.created_at AS joined_date,
      p.email
    FROM public.workspace_members wm
    LEFT JOIN public.profiles p ON p.id = wm.user_id
    WHERE wm.workspace_id = list_workspace_members.workspace_id
    ORDER BY wm.created_at ASC;
  ELSE
    -- Return member profiles WITHOUT email (privacy protected)
    RETURN QUERY
    SELECT
      wm.user_id,
      p.full_name,
      wm.role,
      wm.created_at AS joined_date,
      NULL::TEXT AS email
    FROM public.workspace_members wm
    LEFT JOIN public.profiles p ON p.id = wm.user_id
    WHERE wm.workspace_id = list_workspace_members.workspace_id
    ORDER BY wm.created_at ASC;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.list_workspace_members(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_workspace_members(UUID) TO authenticated;

-- ============================================================================
-- 5. NOTIFY WORKSPACE MEMBERS RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_workspace_members(
  workspace_id UUID,
  title TEXT,
  message TEXT DEFAULT NULL,
  type TEXT DEFAULT 'announcement'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_count INT := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT wm.role INTO v_caller_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = notify_workspace_members.workspace_id
    AND wm.user_id = v_caller_id;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permission denied. Only owners and admins can notify workspace members.';
  END IF;

  INSERT INTO public.notifications (user_id, workspace_id, type, title, message)
  SELECT wm.user_id, notify_workspace_members.workspace_id, notify_workspace_members.type, notify_workspace_members.title, notify_workspace_members.message
  FROM public.workspace_members wm
  WHERE wm.workspace_id = notify_workspace_members.workspace_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_workspace_members(UUID, TEXT, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.notify_workspace_members(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 6. SUBMISSIONS BEFORE UPDATE TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_submission_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_workspace_id UUID;
  v_is_staff BOOLEAN;
BEGIN
  v_caller_id := auth.uid();
  -- If executed without an authenticated user (service role, SQL editor, migrations), bypass checks
  IF v_caller_id IS NULL THEN
    RETURN new;
  END IF;

  -- Assignment's workspace
  SELECT a.workspace_id INTO v_workspace_id
  FROM public.assignments a
  WHERE a.id = old.assignment_id;

  -- Check if caller is owner or admin in this workspace
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = v_workspace_id
      AND wm.user_id = v_caller_id
      AND wm.role = ANY (ARRAY['owner'::text, 'admin'::text])
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    -- Student caller checks
    IF old.student_id <> v_caller_id THEN
      RAISE EXCEPTION 'Permission denied. Cannot update another student''s submission.';
    END IF;

    -- Cannot tamper with immutable fields
    IF new.student_id <> old.student_id THEN
      RAISE EXCEPTION 'Cannot change student_id of a submission.';
    END IF;

    IF new.assignment_id <> old.assignment_id THEN
      RAISE EXCEPTION 'Cannot change assignment_id of a submission.';
    END IF;

    -- Cannot tamper with grade or feedback
    IF (new.grade IS DISTINCT FROM old.grade) THEN
      RAISE EXCEPTION 'Students are not permitted to change grades.';
    END IF;

    IF (new.feedback IS DISTINCT FROM old.feedback) THEN
      RAISE EXCEPTION 'Students are not permitted to change feedback.';
    END IF;

    -- Status transition: only allow pending -> submitted or submitted -> submitted
    IF new.status <> old.status THEN
      IF NOT (old.status = 'pending' AND new.status = 'submitted') THEN
        RAISE EXCEPTION 'Invalid status change. Students may only submit pending work.';
      END IF;
    END IF;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_submission_update ON public.submissions;
CREATE TRIGGER tr_validate_submission_update
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_submission_update();

-- ============================================================================
-- 7. WORKSPACE BEFORE UPDATE TRIGGER (PROTECT owner_id AND type)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_workspace_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
BEGIN
  v_caller_id := auth.uid();
  -- If executed without an authenticated user (service role, SQL editor, migrations), bypass checks
  IF v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Keep id, created_at, owner_id, and type immutable for every caller (Items 2 & 4)
  IF NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'Changing workspace id is not permitted.';
  END IF;

  IF NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Changing workspace created_at is not permitted.';
  END IF;

  IF NEW.owner_id <> OLD.owner_id THEN
    RAISE EXCEPTION 'Changing workspace owner_id is not permitted.';
  END IF;

  IF NEW.type <> OLD.type THEN
    RAISE EXCEPTION 'Changing workspace type is not permitted.';
  END IF;

  -- 2. Direct updates to join_code are blocked from client callers (Item 3)
  IF NEW.join_code <> OLD.join_code THEN
    IF current_setting('app.allow_join_code_regen', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Direct updates to join_code are not permitted. Use regenerate_join_code RPC.';
    END IF;
  END IF;

  -- 3. Lookup caller role in this workspace
  SELECT wm.role INTO v_caller_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = OLD.id
    AND wm.user_id = v_caller_id;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Access denied. You are not a member of this workspace.';
  END IF;

  -- 4. Only owners and admins can update workspaces
  IF v_caller_role = ANY (ARRAY['owner'::text, 'admin'::text]) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Permission denied. Only owners and admins can update workspaces.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_workspace_update ON public.workspaces;
CREATE TRIGGER tr_validate_workspace_update
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_workspace_update();

-- ============================================================================
-- 8. SUBMISSION AFTER INSERT TRIGGER (NOTIFY WORKSPACE STAFF)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_staff_on_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_workspace_id UUID;
  v_assignment_title TEXT;
  v_student_name TEXT;
BEGIN
  -- Look up assignment title and workspace_id
  SELECT a.workspace_id, a.title
  INTO v_workspace_id, v_assignment_title
  FROM public.assignments a
  WHERE a.id = NEW.assignment_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Look up student name
  SELECT coalesce(p.full_name, 'A student')
  INTO v_student_name
  FROM public.profiles p
  WHERE p.id = NEW.student_id;

  -- Insert notification for each owner and admin of the workspace
  INSERT INTO public.notifications (user_id, workspace_id, type, title, message)
  SELECT
    wm.user_id,
    v_workspace_id,
    'submission_received',
    'New submission for ' || coalesce(v_assignment_title, 'assignment'),
    v_student_name || ' submitted their work.'
  FROM public.workspace_members wm
  WHERE wm.workspace_id = v_workspace_id
    AND wm.role = ANY (ARRAY['owner'::text, 'admin'::text]);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_staff_on_submission ON public.submissions;
CREATE TRIGGER tr_notify_staff_on_submission
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_staff_on_submission();

-- ============================================================================
-- 9. PREVENT OWNER MEMBERSHIP ROW DELETION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_owner_member_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Block only direct deletes of an owner row (pg_trigger_depth() = 1).
  -- Allow cascades from workspace or user deletion (pg_trigger_depth() > 1).
  IF pg_trigger_depth() = 1 AND OLD.role = 'owner' THEN
    RAISE EXCEPTION 'Cannot delete workspace owner membership row.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_prevent_owner_member_delete ON public.workspace_members;
CREATE TRIGGER tr_prevent_owner_member_delete
  BEFORE DELETE ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_owner_member_delete();

-- ============================================================================
-- ============================================================================
-- 10. PULL REQUEST INSERT & UPDATE VALIDATION TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_pull_request_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  -- If executed without an authenticated user (service role, SQL editor, migrations), bypass checks
  IF v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Non-service caller: author_id must match authenticated caller
  IF NEW.author_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'author_id must equal the authenticated caller.';
  END IF;

  -- 2. Initial status must be 'open'
  IF NEW.status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'New pull requests must have status = ''open''.';
  END IF;

  -- 3. merged_by and merged_at must be NULL on insert
  IF NEW.merged_by IS NOT NULL THEN
    RAISE EXCEPTION 'merged_by must be NULL on new pull requests.';
  END IF;

  IF NEW.merged_at IS NOT NULL THEN
    RAISE EXCEPTION 'merged_at must be NULL on new pull requests.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_pull_request_insert ON public.pull_requests;
CREATE TRIGGER tr_validate_pull_request_insert
  BEFORE INSERT ON public.pull_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pull_request_insert();

CREATE OR REPLACE FUNCTION public.validate_pull_request_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_workspace_id UUID;
  v_caller_role TEXT;
  v_is_staff BOOLEAN;
  v_is_author BOOLEAN;
BEGIN
  v_caller_id := auth.uid();
  -- If executed without an authenticated user (service role, SQL editor, migrations), bypass checks
  IF v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. author_id and repository_id are strictly immutable (Item 3)
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'author_id is immutable';
  END IF;

  IF NEW.repository_id IS DISTINCT FROM OLD.repository_id THEN
    RAISE EXCEPTION 'repository_id is immutable';
  END IF;

  -- 2. Lookup repository workspace and caller role (deny non-members if caller role is NULL) (Item 3)
  SELECT r.workspace_id INTO v_workspace_id
  FROM public.repositories r
  WHERE r.id = OLD.repository_id;

  SELECT wm.role INTO v_caller_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = v_workspace_id
    AND wm.user_id = v_caller_id;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Access denied. You are not a member of this workspace.';
  END IF;

  v_is_staff := (v_caller_role = ANY (ARRAY['owner'::text, 'admin'::text]));
  v_is_author := (OLD.author_id = v_caller_id);

  -- 3. Status change rules (Item 3)
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Only the PR author or workspace staff (owner/admin) may change status
    IF NOT (v_is_author OR v_is_staff) THEN
      RAISE EXCEPTION 'Only the pull request author or workspace staff can change status.';
    END IF;

    -- Only workspace owner or admin may change status from 'merged' (author cannot un-merge)
    IF OLD.status = 'merged' AND NEW.status IS DISTINCT FROM 'merged' THEN
      IF NOT v_is_staff THEN
        RAISE EXCEPTION 'Only workspace owners and admins can change status from merged.';
      END IF;
    END IF;

    -- Transition into 'merged': only owner/admin
    IF NEW.status = 'merged' THEN
      IF NOT v_is_staff THEN
        RAISE EXCEPTION 'Permission denied. Only owners and admins can merge pull requests.';
      END IF;
      IF NEW.merged_by IS DISTINCT FROM v_caller_id THEN
        RAISE EXCEPTION 'merged_by must equal the authenticated caller.';
      END IF;
      IF NEW.merged_at IS NULL THEN
        NEW.merged_at := now();
      END IF;
    END IF;
  END IF;

  -- 4. Merged_by update rules when status is not changing
  IF NEW.merged_by IS DISTINCT FROM OLD.merged_by AND NEW.merged_by IS NOT NULL THEN
    IF NOT v_is_staff THEN
      RAISE EXCEPTION 'Permission denied. Only owners and admins can set merged_by.';
    END IF;
    IF NEW.merged_by IS DISTINCT FROM v_caller_id THEN
      RAISE EXCEPTION 'merged_by must equal the authenticated caller.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_pull_request_update ON public.pull_requests;
CREATE TRIGGER tr_validate_pull_request_update
  BEFORE UPDATE ON public.pull_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pull_request_update();

-- ============================================================================
-- 11. STANDALONE JOIN ATTEMPTS EXPIRATION CLEANUP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_join_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.join_attempts WHERE attempted_at < (now() - interval '1 day');
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_join_attempts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_join_attempts() TO authenticated;

-- ============================================================================
-- 12. REVOKE EXECUTION ON TRIGGER & INTERNAL FUNCTIONS FROM public & anon
-- ============================================================================

REVOKE ALL ON FUNCTION public.handle_workspace_created() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_join_code() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_workspace_join_code() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_submission_update() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_workspace_update() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_staff_on_submission() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prevent_owner_member_delete() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_pull_request_insert() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_pull_request_update() FROM PUBLIC, anon;



-- >>> START OF supabase/migrations/20261015000005_constraints_and_indexes.sql <<<
-- Migration: 20261015000005_constraints_and_indexes.sql
-- Description: Add missing indexes, drop redundant index, add strict CHECK constraints,
-- set repositories.visibility default to 'private', and add activities to supabase_realtime publication.

-- ============================================================================
-- 1. INDEXES (CREATE MISSING & DROP REDUNDANT)
-- ============================================================================

-- Drop redundant index on grades (submission_id is already covered by grades_submission_id_key unique constraint)
DROP INDEX IF EXISTS public.idx_grades_submission;

-- Create missing high-value query and FK indexes
CREATE INDEX IF NOT EXISTS idx_repositories_workspace ON public.repositories USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_repository_files_branch ON public.repository_files USING btree (branch_id);
CREATE INDEX IF NOT EXISTS idx_commits_branch ON public.commits USING btree (branch_id);
CREATE INDEX IF NOT EXISTS idx_submissions_repository ON public.submissions USING btree (repository_id);
CREATE INDEX IF NOT EXISTS idx_activities_workspace_created ON public.activities USING btree (workspace_id, created_at DESC);

-- Create archive table for deleted duplicate files
CREATE TABLE IF NOT EXISTS public.repository_files_dedup_archive (
  archive_id BIGSERIAL PRIMARY KEY,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  id UUID,
  repository_id UUID,
  branch_id UUID,
  parent_id UUID,
  name TEXT,
  type TEXT,
  content TEXT,
  size_bytes BIGINT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  last_modified_at TIMESTAMPTZ,
  author_id UUID
);

-- Enable RLS and revoke all client access from anon and authenticated (Item 5)
ALTER TABLE public.repository_files_dedup_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.repository_files_dedup_archive FROM anon, authenticated;

-- Deduplication (Item 1, 2):
-- If duplicate FOLDERS exist (type = 'folder'), RAISE EXCEPTION and abort transaction.
-- For duplicate FILES (type = 'file'), copy to archive table first, then delete.
DO $$
DECLARE
  v_dup_folders TEXT;
  v_dup_files_count INT := 0;
BEGIN
  -- A. Check for duplicate FOLDERS (type = 'folder')
  SELECT string_agg(
    format('repo=%s branch=%s parent=%s name="%s" (count=%s)',
           repository_id,
           coalesce(branch_id::text, 'null'),
           coalesce(parent_id::text, 'null'),
           name,
           dup_count),
    E'\n  '
  )
  INTO v_dup_folders
  FROM (
    SELECT
      repository_id,
      COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid) AS branch_id,
      COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid) AS parent_id,
      name,
      count(*) AS dup_count
    FROM public.repository_files
    WHERE type = 'folder'
    GROUP BY
      repository_id,
      COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
      name
    HAVING count(*) > 1
  ) dups;

  IF v_dup_folders IS NOT NULL THEN
    RAISE EXCEPTION E'Migration 5 aborted: Duplicate sibling FOLDERS detected. Manual resolution required:\n  %', v_dup_folders;
  END IF;

  -- B. Copy duplicate FILES (type = 'file') to repository_files_dedup_archive
  WITH dup_file_candidates AS (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY repository_id,
                            COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
                            COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
                            name
               ORDER BY updated_at DESC NULLS LAST, id DESC
             ) AS rnum
      FROM public.repository_files
      WHERE type = 'file'
    ) t
    WHERE t.rnum > 1
  ),
  archived AS (
    INSERT INTO public.repository_files_dedup_archive (
      id, repository_id, branch_id, parent_id, name, type, content, size_bytes, created_by, created_at, updated_at, last_modified_at, author_id
    )
    SELECT
      rf.id, rf.repository_id, rf.branch_id, rf.parent_id, rf.name, rf.type, rf.content, rf.size_bytes, rf.created_by, rf.created_at, rf.updated_at, rf.last_modified_at, rf.author_id
    FROM public.repository_files rf
    JOIN dup_file_candidates dfc ON dfc.id = rf.id
    RETURNING 1
  )
  -- C. Delete duplicate FILES only
  DELETE FROM public.repository_files
  WHERE id IN (SELECT id FROM dup_file_candidates);

  GET DIAGNOSTICS v_dup_files_count = ROW_COUNT;
  IF v_dup_files_count > 0 THEN
    RAISE NOTICE 'Migration 5: Archived and deleted % duplicate file(s) into repository_files_dedup_archive.', v_dup_files_count;
  END IF;
END;
$$;

-- Unique index on repository files to prevent sibling collisions within the same directory / branch
CREATE UNIQUE INDEX IF NOT EXISTS idx_repository_files_unique_entry ON public.repository_files (
  repository_id,
  COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  name
);

-- ============================================================================
-- 2. CHECK CONSTRAINTS (ADDED AS NOT VALID FOR SAFE ROLLOUT)
-- ============================================================================

-- Workspace names: allow Unicode letters/digits/spaces/common punctuation
-- (length 1-100, trimmed, no control characters via [[:cntrl:]] or angle brackets) (Items 3, 5)
ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_name_format_check,
  ADD CONSTRAINT workspaces_name_format_check
  CHECK (
    char_length(name) >= 1 AND
    char_length(name) <= 100 AND
    trim(name) = name AND
    name NOT LIKE '%<%' AND
    name NOT LIKE '%>%' AND
    name !~ '[[:cntrl:]]'
  ) NOT VALID;

-- Workspace join codes: uppercase alphanumeric TEAM-XXXXXXXX (Item 3)
ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_join_code_format_check,
  ADD CONSTRAINT workspaces_join_code_format_check
  CHECK (join_code ~ '^TEAM-[A-Z0-9]{8}$') NOT VALID;

-- Repository name: strict ASCII alphanumeric, hyphens, underscores, dots (no spaces; 1-100 chars, no dot-only names) (Item 3)
ALTER TABLE public.repositories
  DROP CONSTRAINT IF EXISTS repositories_name_format_check,
  ADD CONSTRAINT repositories_name_format_check
  CHECK (
    char_length(name) >= 1 AND
    char_length(name) <= 100 AND
    name ~ '^[a-zA-Z0-9_\-\.]+$' AND
    name !~ '^\.+$'
  ) NOT VALID;

-- Repository file names: strict ASCII, no path separators or traversal segments (1-100 chars, no control chars via [[:cntrl:]]) (Item 3, 6)
ALTER TABLE public.repository_files
  DROP CONSTRAINT IF EXISTS repository_files_filename_safe_check,
  ADD CONSTRAINT repository_files_filename_safe_check
  CHECK (
    char_length(name) >= 1 AND
    char_length(name) <= 100 AND
    name NOT LIKE '%/%' AND
    name <> '.' AND
    name <> '..' AND
    name ~ '^[a-zA-Z0-9_\-\.]+$' AND
    name !~ '[[:cntrl:]]'
  ) NOT VALID;

-- File content size limit (512 KB = 524,288 bytes)
ALTER TABLE public.repository_files
  DROP CONSTRAINT IF EXISTS repository_files_content_limit_check,
  ADD CONSTRAINT repository_files_content_limit_check
  CHECK (content IS NULL OR octet_length(content) <= 524288) NOT VALID;

-- Grade non-negative checks
ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_max_points_positive_check,
  ADD CONSTRAINT assignments_max_points_positive_check
  CHECK (max_points IS NULL OR max_points > 0) NOT VALID;

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_grade_non_negative_check,
  ADD CONSTRAINT submissions_grade_non_negative_check
  CHECK (grade IS NULL OR grade >= 0) NOT VALID;

ALTER TABLE public.grades
  DROP CONSTRAINT IF EXISTS grades_grade_non_negative_check,
  ADD CONSTRAINT grades_grade_non_negative_check
  CHECK (grade IS NULL OR grade >= 0) NOT VALID;

-- ============================================================================
-- 3. REPOSITORIES DEFAULT VISIBILITY -> 'private'
-- ============================================================================

-- Change default to 'private' without altering existing records
ALTER TABLE public.repositories ALTER COLUMN visibility SET DEFAULT 'private';

-- ============================================================================
-- 4. REALTIME PUBLICATION FOR ACTIVITIES TABLE
-- ============================================================================

-- Rationale: The frontend service `activityService.js` subscribes to postgres_changes
-- on table 'activities'. Without adding it to `supabase_realtime`, client activity feeds
-- never receive live events. Realtime respects Row Level Security on the table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activities'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
    END IF;
  END IF;
END $$;


COMMIT;
