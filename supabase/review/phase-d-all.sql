-- ============================================================================
-- PHASE D MASTER REVIEW BUNDLE
-- Contains all migrations, rollbacks, preflight, validation, security advisor, and tests.
-- Generated for comprehensive architecture review.
-- ============================================================================

/******************************************************************************
 * [FILE]: supabase/migrations/20261015000000_live_schema_baseline.sql
 * [DESCRIPTION]: BASELINE MIGRATION (TEST ONLY)
 ******************************************************************************/

-- Migration: 20261015000000_live_schema_baseline.sql
-- Description: Baseline migration recreating the live database schema from export.
-- Note: Apply this ONLY to fresh/test environments. Skip on live database.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email TEXT
);

-- workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'team' CHECK (type = ANY (ARRAY['team'::text, 'classroom'::text])),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  join_code TEXT UNIQUE
);

-- workspace_members
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'contributor' CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'contributor'::text, 'viewer'::text])),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- classrooms (legacy table from export)
CREATE TABLE IF NOT EXISTS public.classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- repositories
CREATE TABLE IF NOT EXISTS public.repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  visibility TEXT DEFAULT 'public' CHECK (visibility = ANY (ARRAY['public'::text, 'private'::text])),
  language TEXT,
  created_by UUID REFERENCES auth.users(id),
  last_updated TIMESTAMPTZ DEFAULT now(),
  default_branch TEXT DEFAULT 'main',
  parent_repository_id UUID REFERENCES public.repositories(id) ON DELETE SET NULL,
  is_fork BOOLEAN DEFAULT false,
  stars_count INTEGER DEFAULT 0,
  forks_count INTEGER DEFAULT 0,
  size_bytes BIGINT DEFAULT 0
);

-- branches
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  latest_commit_id UUID,
  UNIQUE (repository_id, name)
);

-- commits
CREATE TABLE IF NOT EXISTS public.commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  branch_id UUID REFERENCES public.branches(id)
);

-- Add deferred FK from branches.latest_commit_id to commits.id
ALTER TABLE public.branches
  ADD CONSTRAINT branches_latest_commit_id_fkey
  FOREIGN KEY (latest_commit_id) REFERENCES public.commits(id) ON DELETE SET NULL;

-- repository_files
CREATE TABLE IF NOT EXISTS public.repository_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'file' CHECK (type = ANY (ARRAY['file'::text, 'folder'::text])),
  parent_id UUID REFERENCES public.repository_files(id) ON DELETE CASCADE,
  content TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  branch_id UUID REFERENCES public.branches(id),
  size_bytes BIGINT DEFAULT 0,
  last_modified_at TIMESTAMPTZ DEFAULT now(),
  author_id UUID REFERENCES auth.users(id)
);

-- repo_files (legacy table from export)
CREATE TABLE IF NOT EXISTS public.repo_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT,
  type TEXT DEFAULT 'file' CHECK (type = ANY (ARRAY['file'::text, 'folder'::text])),
  parent_id UUID REFERENCES public.repo_files(id) ON DELETE CASCADE,
  size_bytes BIGINT DEFAULT 0,
  last_modified_at TIMESTAMPTZ DEFAULT now(),
  author_id UUID REFERENCES auth.users(id)
);

-- commit_files
CREATE TABLE IF NOT EXISTS public.commit_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commit_id UUID NOT NULL REFERENCES public.commits(id) ON DELETE CASCADE,
  file_id UUID REFERENCES public.repository_files(id) ON DELETE SET NULL,
  file_path TEXT,
  file_name TEXT,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- assignments
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  max_points NUMERIC DEFAULT 100
);

-- submissions
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  repository_id UUID REFERENCES public.repositories(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  grade NUMERIC,
  feedback TEXT,
  status TEXT DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'submitted'::text, 'reviewed'::text, 'returned'::text]))
);

-- grades
CREATE TABLE IF NOT EXISTS public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES public.submissions(id) ON DELETE CASCADE,
  grader_id UUID REFERENCES auth.users(id),
  grade NUMERIC,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- activities
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  repository_id UUID REFERENCES public.repositories(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- pull_requests
CREATE TABLE IF NOT EXISTS public.pull_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  source_branch TEXT NOT NULL,
  target_branch TEXT NOT NULL DEFAULT 'main',
  title TEXT NOT NULL,
  description TEXT,
  author_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status = ANY (ARRAY['open'::text, 'merged'::text, 'closed'::text])),
  merged_by UUID REFERENCES auth.users(id),
  merged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- pull_request_comments
CREATE TABLE IF NOT EXISTS public.pull_request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pull_request_id UUID NOT NULL REFERENCES public.pull_requests(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- repository_stars
CREATE TABLE IF NOT EXISTS public.repository_stars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (repository_id, user_id)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_repository_files_repo ON public.repository_files USING btree (repository_id);
CREATE INDEX IF NOT EXISTS idx_repository_files_parent ON public.repository_files USING btree (parent_id);
CREATE INDEX IF NOT EXISTS idx_activities_workspace ON public.activities USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_grades_submission ON public.grades USING btree (submission_id);
CREATE INDEX IF NOT EXISTS idx_commit_files_commit ON public.commit_files USING btree (commit_id);
CREATE INDEX IF NOT EXISTS idx_pr_repo ON public.pull_requests USING btree (repository_id);
CREATE INDEX IF NOT EXISTS idx_pr_status ON public.pull_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_pr_comments_pr ON public.pull_request_comments USING btree (pull_request_id);
CREATE INDEX IF NOT EXISTS idx_repo_stars_repo ON public.repository_stars USING btree (repository_id);
CREATE INDEX IF NOT EXISTS idx_repo_stars_user ON public.repository_stars USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_repositories_parent ON public.repositories USING btree (parent_repository_id);
CREATE INDEX IF NOT EXISTS idx_branches_repo ON public.branches USING btree (repository_id);
CREATE INDEX IF NOT EXISTS idx_repo_files_parent ON public.repo_files USING btree (parent_id);
CREATE INDEX IF NOT EXISTS idx_repo_files_repo ON public.repo_files USING btree (repository_id);
CREATE INDEX IF NOT EXISTS idx_assignments_workspace ON public.assignments USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON public.submissions USING btree (assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON public.submissions USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_commits_repo ON public.commits USING btree (repository_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications USING btree (user_id, read);

-- ============================================================================
-- 3. FUNCTIONS & TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_workspace_role(_workspace_id uuid, _roles text[], _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _user_id
      AND wm.role = ANY (_roles)
  );
$function$;

CREATE OR REPLACE FUNCTION public.set_repo_files_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS set_repo_files_updated_at ON public.repo_files;
CREATE TRIGGER set_repo_files_updated_at
  BEFORE UPDATE ON public.repo_files
  FOR EACH ROW EXECUTE FUNCTION public.set_repo_files_updated_at();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (ENABLE ON ALL 18 TABLES)
-- ============================================================================

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commit_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pull_request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repo_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repository_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repository_stars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. BASELINE POLICIES (EXACTLY AS EXPORTED)
-- ============================================================================

-- activities
CREATE POLICY "activities_insert" ON public.activities FOR INSERT TO public WITH CHECK (actor_id = auth.uid());
CREATE POLICY "activities_select" ON public.activities FOR SELECT TO public USING (is_workspace_member(workspace_id));

-- assignments
CREATE POLICY "assignments_insert" ON public.assignments FOR INSERT TO public WITH CHECK (is_workspace_role(workspace_id, ARRAY['owner'::text, 'maintainer'::text]));
CREATE POLICY "assignments_select" ON public.assignments FOR SELECT TO public USING (is_workspace_member(workspace_id));

-- branches
CREATE POLICY "branches_all" ON public.branches FOR ALL TO public USING (true) WITH CHECK (true);

-- commit_files
CREATE POLICY "commit_files_all" ON public.commit_files FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "commit_files_insert" ON public.commit_files FOR INSERT TO public WITH CHECK (is_workspace_member(( SELECT r.workspace_id FROM (commits c JOIN repositories r ON ((r.id = c.repository_id))) WHERE (c.id = commit_files.commit_id))));
CREATE POLICY "commit_files_select" ON public.commit_files FOR SELECT TO public USING (is_workspace_member(( SELECT r.workspace_id FROM (commits c JOIN repositories r ON ((r.id = c.repository_id))) WHERE (c.id = commit_files.commit_id))));

-- commits
CREATE POLICY "commits_insert" ON public.commits FOR INSERT TO public WITH CHECK (is_workspace_member(( SELECT r.workspace_id FROM repositories r WHERE (r.id = commits.repository_id))));
CREATE POLICY "commits_select" ON public.commits FOR SELECT TO public USING (is_workspace_member(( SELECT r.workspace_id FROM repositories r WHERE (r.id = commits.repository_id))));

-- grades
CREATE POLICY "grades_select" ON public.grades FOR SELECT TO public USING (((EXISTS ( SELECT 1 FROM submissions s WHERE ((s.id = grades.submission_id) AND (s.student_id = auth.uid())))) OR (EXISTS ( SELECT 1 FROM (submissions s JOIN assignments a ON ((a.id = s.assignment_id))) WHERE ((s.id = grades.submission_id) AND is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'maintainer'::text]))))));
CREATE POLICY "grades_upsert" ON public.grades FOR ALL TO public USING ((EXISTS ( SELECT 1 FROM (submissions s JOIN assignments a ON ((a.id = s.assignment_id))) WHERE ((s.id = grades.submission_id) AND is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'maintainer'::text]))))) WITH CHECK ((EXISTS ( SELECT 1 FROM (submissions s JOIN assignments a ON ((a.id = s.assignment_id))) WHERE ((s.id = grades.submission_id) AND is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'maintainer'::text])))));

-- notifications
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO public USING (user_id = auth.uid());
CREATE POLICY "notifications_insert_all" ON public.notifications FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "notifications_own" ON public.notifications FOR SELECT TO public USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO public USING (user_id = auth.uid());

-- profiles
CREATE POLICY "Profiles: users can insert own" ON public.profiles FOR INSERT TO public WITH CHECK (id = auth.uid());
CREATE POLICY "Profiles: users can read own" ON public.profiles FOR SELECT TO public USING (id = auth.uid());
CREATE POLICY "Profiles: users can update own" ON public.profiles FOR UPDATE TO public USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO public WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO public USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO public USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- pull_request_comments
CREATE POLICY "pull_request_comments_all" ON public.pull_request_comments FOR ALL TO public USING (true) WITH CHECK (true);

-- pull_requests
CREATE POLICY "pull_requests_all" ON public.pull_requests FOR ALL TO public USING (true) WITH CHECK (true);

-- repo_files
CREATE POLICY "repo_files_members_insert" ON public.repo_files FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM (repositories r JOIN workspace_members wm ON ((wm.workspace_id = r.workspace_id))) WHERE ((r.id = repo_files.repository_id) AND (wm.user_id = auth.uid())))));
CREATE POLICY "repo_files_members_read" ON public.repo_files FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM (repositories r JOIN workspace_members wm ON ((wm.workspace_id = r.workspace_id))) WHERE ((r.id = repo_files.repository_id) AND (wm.user_id = auth.uid())))));
CREATE POLICY "repo_files_members_update" ON public.repo_files FOR UPDATE TO public USING ((EXISTS ( SELECT 1 FROM (repositories r JOIN workspace_members wm ON ((wm.workspace_id = r.workspace_id))) WHERE ((r.id = repo_files.repository_id) AND (wm.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM (repositories r JOIN workspace_members wm ON ((wm.workspace_id = r.workspace_id))) WHERE ((r.id = repo_files.repository_id) AND (wm.user_id = auth.uid())))));

-- repositories
CREATE POLICY "repositories_delete" ON public.repositories FOR DELETE TO public USING (is_workspace_role(workspace_id, ARRAY['owner'::text]));
CREATE POLICY "repositories_insert" ON public.repositories FOR INSERT TO public WITH CHECK (is_workspace_role(workspace_id, ARRAY['owner'::text, 'maintainer'::text]));
CREATE POLICY "repositories_members_read" ON public.repositories FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM workspace_members wm WHERE ((wm.workspace_id = repositories.workspace_id) AND (wm.user_id = auth.uid())))));
CREATE POLICY "repositories_owner_insert" ON public.repositories FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM workspaces w WHERE ((w.id = repositories.workspace_id) AND (w.owner_id = auth.uid())))));
CREATE POLICY "repositories_select" ON public.repositories FOR SELECT TO public USING (is_workspace_member(workspace_id));
CREATE POLICY "repositories_update" ON public.repositories FOR UPDATE TO public USING (is_workspace_role(workspace_id, ARRAY['owner'::text, 'maintainer'::text]));

-- repository_files
CREATE POLICY "repository_files_select" ON public.repository_files FOR SELECT TO public USING (is_workspace_member(( SELECT r.workspace_id FROM repositories r WHERE (r.id = repository_files.repository_id))));
CREATE POLICY "repository_files_write" ON public.repository_files FOR ALL TO public USING (is_workspace_role(( SELECT r.workspace_id FROM repositories r WHERE (r.id = repository_files.repository_id)), ARRAY['owner'::text, 'maintainer'::text, 'member'::text])) WITH CHECK (is_workspace_role(( SELECT r.workspace_id FROM repositories r WHERE (r.id = repository_files.repository_id)), ARRAY['owner'::text, 'maintainer'::text, 'member'::text]));

-- repository_stars
CREATE POLICY "repository_stars_all" ON public.repository_stars FOR ALL TO public USING (true) WITH CHECK (true);

-- submissions
CREATE POLICY "submissions_insert" ON public.submissions FOR INSERT TO public WITH CHECK (student_id = auth.uid());
CREATE POLICY "submissions_select" ON public.submissions FOR SELECT TO public USING (((student_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM assignments a WHERE ((a.id = submissions.assignment_id) AND is_workspace_member(a.workspace_id))))));
CREATE POLICY "submissions_update" ON public.submissions FOR UPDATE TO public USING (((student_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM assignments a WHERE ((a.id = submissions.assignment_id) AND is_workspace_role(a.workspace_id, ARRAY['owner'::text, 'maintainer'::text]))))));

-- workspace_members
CREATE POLICY "workspace_members_delete" ON public.workspace_members FOR DELETE TO public USING (is_workspace_role(workspace_id, ARRAY['owner'::text]));
CREATE POLICY "workspace_members_insert" ON public.workspace_members FOR INSERT TO public WITH CHECK ((is_workspace_role(workspace_id, ARRAY['owner'::text, 'maintainer'::text]) OR (auth.uid() = user_id)));
CREATE POLICY "workspace_members_insert_self" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workspace_members_select" ON public.workspace_members FOR SELECT TO public USING (is_workspace_member(workspace_id));
CREATE POLICY "workspace_members_select_own" ON public.workspace_members FOR SELECT TO public USING (user_id = auth.uid());

-- workspaces
CREATE POLICY "Anyone authenticated can read workspaces to join" ON public.workspaces FOR SELECT TO authenticated USING (true);
CREATE POLICY "workspaces_delete" ON public.workspaces FOR DELETE TO public USING (is_workspace_role(id, ARRAY['owner'::text]));
CREATE POLICY "workspaces_insert" ON public.workspaces FOR INSERT TO public WITH CHECK (owner_id = auth.uid());
CREATE POLICY "workspaces_insert_owners" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "workspaces_members_read" ON public.workspaces FOR SELECT TO public USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM workspace_members wm WHERE ((wm.workspace_id = workspaces.id) AND (wm.user_id = auth.uid()))))));
CREATE POLICY "workspaces_owner_all" ON public.workspaces FOR ALL TO public USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "workspaces_select" ON public.workspaces FOR SELECT TO public USING (is_workspace_member(id));
CREATE POLICY "workspaces_update" ON public.workspaces FOR UPDATE TO public USING (is_workspace_role(id, ARRAY['owner'::text, 'maintainer'::text]));


/******************************************************************************
 * [FILE]: supabase/migrations/20261015000000_live_schema_baseline_rollback.sql
 * [DESCRIPTION]: BASELINE ROLLBACK
 ******************************************************************************/

-- Rollback for 20261015000000_live_schema_baseline.sql
-- WARNING: Destructive rollback for clean test project reset only.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS set_repo_files_updated_at ON public.repo_files;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_workspace_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_workspace_role(uuid, text[], uuid) CASCADE;
DROP FUNCTION IF EXISTS public.set_repo_files_updated_at() CASCADE;

DROP TABLE IF EXISTS public.repository_stars CASCADE;
DROP TABLE IF EXISTS public.pull_request_comments CASCADE;
DROP TABLE IF EXISTS public.pull_requests CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.grades CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.commit_files CASCADE;
DROP TABLE IF EXISTS public.repo_files CASCADE;
DROP TABLE IF EXISTS public.repository_files CASCADE;
DROP TABLE IF EXISTS public.commits CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.repositories CASCADE;
DROP TABLE IF EXISTS public.classrooms CASCADE;
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;


/******************************************************************************
 * [FILE]: supabase/migrations/20261015000001_security_lockdown.sql
 * [DESCRIPTION]: MIGRATION 1: SECURITY LOCKDOWN
 ******************************************************************************/

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


/******************************************************************************
 * [FILE]: supabase/migrations/20261015000001_security_lockdown_rollback.sql
 * [DESCRIPTION]: ROLLBACK 1: SECURITY LOCKDOWN
 ******************************************************************************/

-- Rollback for 20261015000001_security_lockdown.sql
-- Restores grants to anon and resets baseline policies.

-- Restore grants to anon and authenticated
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon;

GRANT TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO authenticated;

-- Reset default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE, REFERENCES, TRIGGER ON TABLES TO authenticated;

-- Drop tightened policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON public.workspaces;

DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete" ON public.workspace_members;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;

DROP POLICY IF EXISTS "activities_select" ON public.activities;
DROP POLICY IF EXISTS "activities_insert" ON public.activities;

DROP POLICY IF EXISTS "assignments_select" ON public.assignments;
DROP POLICY IF EXISTS "assignments_insert" ON public.assignments;
DROP POLICY IF EXISTS "assignments_update" ON public.assignments;
DROP POLICY IF EXISTS "assignments_delete" ON public.assignments;

DROP POLICY IF EXISTS "submissions_select" ON public.submissions;
DROP POLICY IF EXISTS "submissions_insert" ON public.submissions;
DROP POLICY IF EXISTS "submissions_update" ON public.submissions;

DROP POLICY IF EXISTS "grades_select" ON public.grades;
DROP POLICY IF EXISTS "grades_all" ON public.grades;

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

-- Restore baseline policies
CREATE POLICY "activities_insert" ON public.activities FOR INSERT TO public WITH CHECK (actor_id = auth.uid());
CREATE POLICY "activities_select" ON public.activities FOR SELECT TO public USING (is_workspace_member(workspace_id));

CREATE POLICY "assignments_insert" ON public.assignments FOR INSERT TO public WITH CHECK (is_workspace_role(workspace_id, ARRAY['owner'::text, 'maintainer'::text]));
CREATE POLICY "assignments_select" ON public.assignments FOR SELECT TO public USING (is_workspace_member(workspace_id));

CREATE POLICY "branches_all" ON public.branches FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "commit_files_all" ON public.commit_files FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "commits_insert" ON public.commits FOR INSERT TO public WITH CHECK (is_workspace_member(( SELECT r.workspace_id FROM repositories r WHERE (r.id = commits.repository_id))));
CREATE POLICY "commits_select" ON public.commits FOR SELECT TO public USING (is_workspace_member(( SELECT r.workspace_id FROM repositories r WHERE (r.id = commits.repository_id))));

CREATE POLICY "notifications_insert_all" ON public.notifications FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "notifications_own" ON public.notifications FOR SELECT TO public USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO public USING (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO public USING (user_id = auth.uid());

CREATE POLICY "Profiles: users can insert own" ON public.profiles FOR INSERT TO public WITH CHECK (id = auth.uid());
CREATE POLICY "Profiles: users can read own" ON public.profiles FOR SELECT TO public USING (id = auth.uid());
CREATE POLICY "Profiles: users can update own" ON public.profiles FOR UPDATE TO public USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "pull_request_comments_all" ON public.pull_request_comments FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "pull_requests_all" ON public.pull_requests FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "repository_stars_all" ON public.repository_stars FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Anyone authenticated can read workspaces to join" ON public.workspaces FOR SELECT TO authenticated USING (true);


/******************************************************************************
 * [FILE]: supabase/migrations/20261015000002_security_helpers.sql
 * [DESCRIPTION]: MIGRATION 2: SECURITY HELPERS (APP_PRIVATE)
 ******************************************************************************/

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
  _user_id UUID DEFAULT (SELECT auth.uid())
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
  _user_id UUID DEFAULT (SELECT auth.uid())
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
  _user_id UUID DEFAULT (SELECT auth.uid())
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
  _user_id UUID DEFAULT (SELECT auth.uid())
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
  _user_id UUID DEFAULT (SELECT auth.uid())
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


/******************************************************************************
 * [FILE]: supabase/migrations/20261015000002_security_helpers_rollback.sql
 * [DESCRIPTION]: ROLLBACK 2: SECURITY HELPERS
 ******************************************************************************/

-- Rollback for 20261015000002_security_helpers.sql

DROP FUNCTION IF EXISTS app_private.can_write_repo(uuid, uuid);
DROP FUNCTION IF EXISTS app_private.can_read_repo(uuid, uuid);
DROP FUNCTION IF EXISTS app_private.is_workspace_role(uuid, text[], uuid);
DROP FUNCTION IF EXISTS app_private.is_workspace_member(uuid, uuid);
DROP FUNCTION IF EXISTS app_private.workspace_role(uuid, uuid);

DROP SCHEMA IF EXISTS app_private CASCADE;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO public;
GRANT EXECUTE ON FUNCTION public.is_workspace_role(uuid, text[], uuid) TO public;


/******************************************************************************
 * [FILE]: supabase/migrations/20261015000003_role_matrix_rls.sql
 * [DESCRIPTION]: MIGRATION 3: ROLE MATRIX & REPO ISOLATION
 ******************************************************************************/

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


/******************************************************************************
 * [FILE]: supabase/migrations/20261015000003_role_matrix_rls_rollback.sql
 * [DESCRIPTION]: ROLLBACK 3: ROLE MATRIX & REPO ISOLATION
 ******************************************************************************/

-- Rollback for 20261015000003_role_matrix_rls.sql
-- Restores the interim D2 policies.

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
DROP POLICY IF EXISTS "repository_files_insert" ON public.repository_files;
DROP POLICY IF EXISTS "repository_files_update" ON public.repository_files;
DROP POLICY IF EXISTS "repository_files_delete" ON public.repository_files;

DROP POLICY IF EXISTS "branches_select" ON public.branches;
DROP POLICY IF EXISTS "branches_insert" ON public.branches;
DROP POLICY IF EXISTS "branches_update" ON public.branches;
DROP POLICY IF EXISTS "branches_delete" ON public.branches;

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

-- Recreate basic D2 policies
CREATE POLICY "workspaces_select" ON public.workspaces FOR SELECT TO authenticated USING (is_workspace_member(id, (SELECT auth.uid())));
CREATE POLICY "workspaces_insert" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY "workspaces_update" ON public.workspaces FOR UPDATE TO authenticated USING (is_workspace_role(id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid())));
CREATE POLICY "workspaces_delete" ON public.workspaces FOR DELETE TO authenticated USING (is_workspace_role(id, ARRAY['owner'::text], (SELECT auth.uid())));

CREATE POLICY "workspace_members_select" ON public.workspace_members FOR SELECT TO authenticated USING (is_workspace_member(workspace_id, (SELECT auth.uid())));
CREATE POLICY "workspace_members_delete" ON public.workspace_members FOR DELETE TO authenticated USING (is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid())));

CREATE POLICY "repositories_select" ON public.repositories FOR SELECT TO authenticated USING (is_workspace_member(workspace_id, (SELECT auth.uid())));
CREATE POLICY "repositories_insert" ON public.repositories FOR INSERT TO authenticated WITH CHECK (created_by = (SELECT auth.uid()) AND is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid())));
CREATE POLICY "repositories_update" ON public.repositories FOR UPDATE TO authenticated USING (is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'contributor'::text], (SELECT auth.uid())));
CREATE POLICY "repositories_delete" ON public.repositories FOR DELETE TO authenticated USING (is_workspace_role(workspace_id, ARRAY['owner'::text], (SELECT auth.uid())));

CREATE POLICY "assignments_select" ON public.assignments FOR SELECT TO authenticated USING (is_workspace_member(workspace_id, (SELECT auth.uid())));
CREATE POLICY "assignments_insert" ON public.assignments FOR INSERT TO authenticated WITH CHECK (is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid())));
CREATE POLICY "assignments_update" ON public.assignments FOR UPDATE TO authenticated USING (is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid())));
CREATE POLICY "assignments_delete" ON public.assignments FOR DELETE TO authenticated USING (is_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text], (SELECT auth.uid())));

CREATE POLICY "activities_select" ON public.activities FOR SELECT TO authenticated USING (workspace_id IS NULL OR is_workspace_member(workspace_id, (SELECT auth.uid())));
CREATE POLICY "activities_insert" ON public.activities FOR INSERT TO authenticated WITH CHECK (actor_id = (SELECT auth.uid()) AND (workspace_id IS NULL OR is_workspace_member(workspace_id, (SELECT auth.uid()))));


/******************************************************************************
 * [FILE]: supabase/migrations/20261015000004_rpcs_and_triggers.sql
 * [DESCRIPTION]: MIGRATION 4: RPCS & TRIGGERS
 ******************************************************************************/

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

CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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

-- ============================================================================
-- 3. RATE-LIMITED JOIN WORKSPACE RPC
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.join_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_join_attempts_user_time ON public.join_attempts (user_id, attempted_at DESC);

ALTER TABLE public.join_attempts ENABLE ROW LEVEL SECURITY;
-- No client policies on join_attempts: access strictly through SECURITY DEFINER RPC

CREATE OR REPLACE FUNCTION public.join_workspace(code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_clean_code TEXT;
  v_recent_attempts INT;
  v_workspace RECORD;
  v_member_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 0. Clean up join attempts older than 1 day
  DELETE FROM public.join_attempts
  WHERE attempted_at < (now() - interval '1 day');

  -- 1. Rate limit: max 10 attempts per 10 minutes per user
  SELECT count(*)
  INTO v_recent_attempts
  FROM public.join_attempts
  WHERE user_id = v_user_id
    AND attempted_at > (now() - interval '10 minutes');

  IF v_recent_attempts >= 10 THEN
    RAISE EXCEPTION 'Too many join attempts. Please try again later.';
  END IF;

  -- Record attempt
  INSERT INTO public.join_attempts (user_id, attempted_at)
  VALUES (v_user_id, now());

  -- 2. Validate format and lookup workspace
  v_clean_code := upper(trim(code));
  IF v_clean_code IS NULL OR length(v_clean_code) < 5 THEN
    RAISE EXCEPTION 'Invalid workspace code.';
  END IF;

  SELECT id, name, owner_id
  INTO v_workspace
  FROM public.workspaces
  WHERE join_code = v_clean_code;

  -- Identical error message for wrong, non-existent, or expired code
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid workspace code.';
  END IF;

  IF v_workspace.owner_id = v_user_id THEN
    RAISE EXCEPTION 'You are the owner of this workspace already.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_workspace.id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You are already a member of this workspace.';
  END IF;

  -- 3. Insert contributor role only
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
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Never permit changing owner_id or workspace type
  IF NEW.owner_id <> OLD.owner_id THEN
    RAISE EXCEPTION 'Changing workspace owner_id is not permitted.';
  END IF;

  IF NEW.type <> OLD.type THEN
    RAISE EXCEPTION 'Changing workspace type is not permitted.';
  END IF;

  -- 2. Lookup caller role in this workspace
  SELECT wm.role INTO v_caller_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = OLD.id
    AND wm.user_id = v_caller_id;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Access denied. You are not a member of this workspace.';
  END IF;

  -- 3. Admins may ONLY change name and join_code
  IF v_caller_role = 'admin' THEN
    IF NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'Admins cannot change created_at.';
    END IF;
  ELSIF v_caller_role = 'owner' THEN
    -- Owner can update name and join_code (owner_id and type already protected above)
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
  IF OLD.role = 'owner' THEN
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
-- 10. PULL REQUEST STATUS / MERGED_BY UPDATE VALIDATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_pull_request_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_workspace_id UUID;
  v_is_staff BOOLEAN;
  v_is_author BOOLEAN;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT r.workspace_id INTO v_workspace_id
  FROM public.repositories r
  WHERE r.id = OLD.repository_id;

  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = v_workspace_id
      AND wm.user_id = v_caller_id
      AND wm.role = ANY (ARRAY['owner'::text, 'admin'::text])
  ) INTO v_is_staff;

  v_is_author := (OLD.author_id = v_caller_id);

  -- Only PR author or owner/admin can change status
  IF (NEW.status <> OLD.status) AND NOT (v_is_author OR v_is_staff) THEN
    RAISE EXCEPTION 'Only the pull request author or workspace staff can change status.';
  END IF;

  -- Only staff (owner/admin) or author can set merged_by
  IF (NEW.merged_by IS DISTINCT FROM OLD.merged_by) AND NOT (v_is_staff OR v_is_author) THEN
    RAISE EXCEPTION 'Only the pull request author or workspace staff can set merged_by.';
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


/******************************************************************************
 * [FILE]: supabase/migrations/20261015000004_rpcs_and_triggers_rollback.sql
 * [DESCRIPTION]: ROLLBACK 4: RPCS & TRIGGERS
 ******************************************************************************/

-- Rollback for 20261015000004_rpcs_and_triggers.sql

DROP TRIGGER IF EXISTS tr_validate_pull_request_update ON public.pull_requests;
DROP FUNCTION IF EXISTS public.validate_pull_request_update();

DROP TRIGGER IF EXISTS tr_prevent_owner_member_delete ON public.workspace_members;
DROP FUNCTION IF EXISTS public.prevent_owner_member_delete();

DROP TRIGGER IF EXISTS tr_notify_staff_on_submission ON public.submissions;
DROP FUNCTION IF EXISTS public.notify_staff_on_submission();

DROP TRIGGER IF EXISTS tr_validate_workspace_update ON public.workspaces;
DROP FUNCTION IF EXISTS public.validate_workspace_update();

DROP TRIGGER IF EXISTS tr_validate_submission_update ON public.submissions;
DROP FUNCTION IF EXISTS public.validate_submission_update();

DROP FUNCTION IF EXISTS public.cleanup_expired_join_attempts();
DROP FUNCTION IF EXISTS public.notify_workspace_members(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.list_workspace_members(uuid);
DROP FUNCTION IF EXISTS public.join_workspace(text);

DROP TABLE IF EXISTS public.join_attempts CASCADE;

ALTER TABLE public.workspaces ALTER COLUMN join_code DROP DEFAULT;
DROP FUNCTION IF EXISTS public.generate_join_code();

DROP TRIGGER IF EXISTS tr_workspace_created ON public.workspaces;
DROP FUNCTION IF EXISTS public.handle_workspace_created();

-- Restore original self-insert policies if needed
CREATE POLICY "workspace_members_insert_self" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);


/******************************************************************************
 * [FILE]: supabase/migrations/20261015000005_constraints_and_indexes.sql
 * [DESCRIPTION]: MIGRATION 5: CONSTRAINTS & INDEXES
 ******************************************************************************/

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

-- Workspace name length & charset (alphanumeric, spaces, hyphens, underscores, dots; 1-100 chars)
ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_name_format_check,
  ADD CONSTRAINT workspaces_name_format_check
  CHECK (
    char_length(name) >= 1 AND
    char_length(name) <= 100 AND
    name ~ '^[a-zA-Z0-9_\-\. ]+$'
  ) NOT VALID;

-- Repository name length & charset (no spaces, standard slug-compatible repo names; 1-100 chars)
ALTER TABLE public.repositories
  DROP CONSTRAINT IF EXISTS repositories_name_format_check,
  ADD CONSTRAINT repositories_name_format_check
  CHECK (
    char_length(name) >= 1 AND
    char_length(name) <= 100 AND
    name ~ '^[a-zA-Z0-9_\-\.]+$'
  ) NOT VALID;

-- Repository file names: consistent with execution-server safePath
-- (no '/', '\', '.', '..', no control characters, max 100 chars)
ALTER TABLE public.repository_files
  DROP CONSTRAINT IF EXISTS repository_files_filename_safe_check,
  ADD CONSTRAINT repository_files_filename_safe_check
  CHECK (
    char_length(name) >= 1 AND
    char_length(name) <= 100 AND
    name NOT LIKE '%/%' AND
    name NOT LIKE '%\%' AND
    name <> '.' AND
    name <> '..' AND
    name !~ '[\x00-\x1f\x7f]'
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


/******************************************************************************
 * [FILE]: supabase/migrations/20261015000005_constraints_and_indexes_rollback.sql
 * [DESCRIPTION]: ROLLBACK 5: CONSTRAINTS & INDEXES
 ******************************************************************************/

-- Rollback for 20261015000005_constraints_and_indexes.sql

-- Remove from realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activities'
    ) THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.activities;
    END IF;
  END IF;
END $$;

-- Reset default visibility
ALTER TABLE public.repositories ALTER COLUMN visibility SET DEFAULT 'public';

-- Drop CHECK constraints
ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_grade_non_negative_check;
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_grade_non_negative_check;
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_max_points_positive_check;
ALTER TABLE public.repository_files DROP CONSTRAINT IF EXISTS repository_files_content_limit_check;
ALTER TABLE public.repository_files DROP CONSTRAINT IF EXISTS repository_files_filename_safe_check;
ALTER TABLE public.repositories DROP CONSTRAINT IF EXISTS repositories_name_format_check;
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_name_format_check;

-- Drop unique index and new indexes
DROP INDEX IF EXISTS public.idx_repository_files_unique_entry;
DROP INDEX IF EXISTS public.idx_activities_workspace_created;
DROP INDEX IF EXISTS public.idx_submissions_repository;
DROP INDEX IF EXISTS public.idx_commits_branch;
DROP INDEX IF EXISTS public.idx_repository_files_branch;
DROP INDEX IF EXISTS public.idx_workspace_members_user;
DROP INDEX IF EXISTS public.idx_repositories_workspace;

-- Restore redundant index
CREATE INDEX IF NOT EXISTS idx_grades_submission ON public.grades USING btree (submission_id);


/******************************************************************************
 * [FILE]: supabase/preflight_live.sql
 * [DESCRIPTION]: PRE-FLIGHT LIVE AUDIT SCRIPT
 ******************************************************************************/

-- ============================================================================
-- PRE-FLIGHT AUDIT SCRIPT FOR LIVE DATABASE (READ-ONLY)
-- ============================================================================
-- Run this entire script in Supabase SQL Editor BEFORE applying migrations.
-- It executes SELECT-only queries to check if any existing rows violate the
-- new constraints, orphaned states, or naming rules.
--
-- If any query returns rows, review and resolve those rows before validation.
-- ============================================================================

-- 1. Check workspace names
-- Criteria: 1-100 characters, alphanumeric, spaces, hyphens, underscores, dots
-- Note: "My Workspace" is completely valid.
SELECT
  'INVALID WORKSPACE NAME' AS check_name,
  id,
  name,
  owner_id,
  created_at
FROM public.workspaces
WHERE name IS NULL
   OR char_length(name) < 1
   OR char_length(name) > 100
   OR name !~ '^[a-zA-Z0-9_\-\. ]+$';

-- 2. Check repository names
-- Criteria: 1-100 characters, alphanumeric, hyphens, underscores, dots (no spaces)
SELECT
  'INVALID REPOSITORY NAME' AS check_name,
  id,
  name,
  workspace_id,
  created_at
FROM public.repositories
WHERE name IS NULL
   OR char_length(name) < 1
   OR char_length(name) > 100
   OR name !~ '^[a-zA-Z0-9_\-\.]+$';

-- 3. Check repositories with NULL created_by
-- (Important for classroom repository isolation)
SELECT
  'NULL REPO CREATED_BY' AS check_name,
  id,
  name,
  workspace_id,
  created_at
FROM public.repositories
WHERE created_by IS NULL;

-- 4. Check workspaces with no corresponding 'owner' membership row
SELECT
  'WORKSPACE WITHOUT OWNER MEMBER ROW' AS check_name,
  w.id AS workspace_id,
  w.name AS workspace_name,
  w.owner_id
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.workspace_id = w.id
    AND wm.user_id = w.owner_id
    AND wm.role = 'owner'
);

-- 5. Check duplicate sibling file names in repository_files
-- (Must be unique within repository + branch + parent folder)
SELECT
  'DUPLICATE SIBLING FILES' AS check_name,
  repository_id,
  COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid) AS branch_id,
  COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid) AS parent_id,
  name,
  count(*) AS duplicate_count
FROM public.repository_files
GROUP BY
  repository_id,
  COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  name
HAVING count(*) > 1;

-- 6. Check files exceeding 512 KB (524,288 bytes)
SELECT
  'FILE EXCEEDS 512KB' AS check_name,
  id,
  repository_id,
  name,
  octet_length(content) AS size_bytes
FROM public.repository_files
WHERE octet_length(content) > 524288;

-- 7. Check file names violating safePath rules
-- (Cannot contain '/', '\', '.', '..', control characters, or exceed 100 chars)
SELECT
  'UNSAFE FILE NAME' AS check_name,
  id,
  repository_id,
  name
FROM public.repository_files
WHERE name LIKE '%/%'
   OR name LIKE '%\%'
   OR name = '.'
   OR name = '..'
   OR name ~ '[\x00-\x1f\x7f]'
   OR char_length(name) < 1
   OR char_length(name) > 100;

-- 8. Check negative grades or invalid assignment max_points
SELECT
  'NEGATIVE SUBMISSION GRADE' AS check_name,
  id,
  assignment_id,
  student_id,
  grade
FROM public.submissions
WHERE grade < 0;

SELECT
  'NEGATIVE GRADE RECORD' AS check_name,
  id,
  submission_id,
  grade
FROM public.grades
WHERE grade < 0;

SELECT
  'INVALID ASSIGNMENT MAX POINTS' AS check_name,
  id,
  workspace_id,
  title,
  max_points
FROM public.assignments
WHERE max_points <= 0;


/******************************************************************************
 * [FILE]: supabase/validate_constraints.sql
 * [DESCRIPTION]: VALIDATE CONSTRAINTS SCRIPT
 ******************************************************************************/

-- ============================================================================
-- VALIDATE CONSTRAINTS SCRIPT FOR LIVE DATABASE
-- ============================================================================
-- Run this script AFTER:
-- 1. preflight_live.sql has reported 0 issues, OR any legacy violations have been corrected.
-- 2. 20261015000005_constraints_and_indexes.sql has applied the constraints as NOT VALID.
--
-- Running VALIDATE verifies all existing rows without acquiring exclusive table write locks.
-- ============================================================================

ALTER TABLE public.workspaces VALIDATE CONSTRAINT workspaces_name_format_check;
ALTER TABLE public.repositories VALIDATE CONSTRAINT repositories_name_format_check;
ALTER TABLE public.repository_files VALIDATE CONSTRAINT repository_files_filename_safe_check;
ALTER TABLE public.repository_files VALIDATE CONSTRAINT repository_files_content_limit_check;
ALTER TABLE public.assignments VALIDATE CONSTRAINT assignments_max_points_positive_check;
ALTER TABLE public.submissions VALIDATE CONSTRAINT submissions_grade_non_negative_check;
ALTER TABLE public.grades VALIDATE CONSTRAINT grades_grade_non_negative_check;


/******************************************************************************
 * [FILE]: supabase/security_advisor.sql
 * [DESCRIPTION]: SECURITY ADVISOR EQUIVALENT AUDIT QUERIES
 ******************************************************************************/

-- Supabase Security Advisor Equivalent Checks
-- Run this in SQL Editor to audit RLS status, unrestricted policies, and exposed functions.

-- ============================================================================
-- 1. TABLES WITHOUT ROW LEVEL SECURITY ENABLED
-- Expected: 0 rows
-- ============================================================================
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;

-- ============================================================================
-- 2. POLICIES WITH UNRESTRICTED 'true' QUALIFIERS
-- Expected: Only profiles_select (authenticated users viewing profile cards), NO public/anon true policies!
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true')
  AND 'anon' = ANY (roles);

-- ============================================================================
-- 3. FUNCTIONS EXECUTABLE BY anon
-- Expected: 0 rows (all anon execute revoked)
-- ============================================================================
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'app_private')
  AND has_function_privilege('anon', p.oid, 'EXECUTE');

-- ============================================================================
-- 4. TABLES ACCESSIBLE BY anon
-- Expected: 0 rows
-- ============================================================================
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'anon'
  AND table_schema = 'public';


/******************************************************************************
 * [FILE]: test/rls.test.js
 * [DESCRIPTION]: AUTOMATED SECURITY & RLS TEST SUITE
 ******************************************************************************/

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 1. Load .env.test via dotenv
const testEnvPath = path.resolve(process.cwd(), '.env.test');
if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath, override: true });
}

// 2. Read .env to compare URLs and prevent accidental runs against production
const prodEnvPath = path.resolve(process.cwd(), '.env');
let prodUrl = null;
if (fs.existsSync(prodEnvPath)) {
  const prodEnvContent = fs.readFileSync(prodEnvPath, 'utf8');
  const match = prodEnvContent.match(/VITE_SUPABASE_URL\s*=\s*([^\r\n#]+)/);
  if (match) {
    prodUrl = match[1].trim().replace(/^["']|["']$/g, '');
  }
}

const SUPABASE_URL = process.env.SUPABASE_TEST_URL || process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 3. REFUSE TO RUN if test URL equals production URL
if (prodUrl && SUPABASE_URL) {
  const normTest = SUPABASE_URL.trim().toLowerCase().replace(/\/$/, '');
  const normProd = prodUrl.trim().toLowerCase().replace(/\/$/, '');
  if (normTest === normProd) {
    throw new Error(
      `CRITICAL SAFETY ABORT: SUPABASE_TEST_URL (${SUPABASE_URL}) equals the production URL in .env (${prodUrl}). Tests must ONLY run against a dedicated test database.`
    );
  }
}

describe('Phase D: Supabase RLS & Role Matrix Security Tests', () => {
  let adminClient;
  let anonClient;
  const users = {};
  const clients = {};
  let teamWorkspace;
  let classroomWorkspace;
  let studentARepo;
  let assignment;
  let submissionA;

  before(async (t) => {
    if (!SERVICE_ROLE_KEY) {
      t.diagnostic('Skipping live DB tests: SUPABASE_SERVICE_ROLE_KEY is not set in environment.');
      t.diagnostic('To run against your test project:');
      t.diagnostic('  $env:SUPABASE_SERVICE_ROLE_KEY="<your-test-service-role-key>"; npm run test:rls');
      return;
    }

    adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const roles = ['owner', 'admin', 'studentA', 'studentB', 'viewer', 'outsider'];
    for (const r of roles) {
      const email = `test_${r}_${Date.now()}@testcollabspace.internal`;
      const password = 'TestSecurePassword123!';
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `Test User ${r}` },
      });
      if (error) throw error;
      users[r] = data.user;

      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: signinError } = await userClient.auth.signInWithPassword({
        email,
        password,
      });
      if (signinError) throw signinError;
      clients[r] = userClient;
    }

    // 1. Create Team Workspace (owned by 'owner')
    const { data: wsTeam, error: teamErr } = await clients.owner
      .from('workspaces')
      .insert({ name: 'Security Audit Team', type: 'team', owner_id: users.owner.id })
      .select('*')
      .single();
    if (teamErr) throw teamErr;
    teamWorkspace = wsTeam;

    // 2. Create Classroom Workspace (owned by 'owner')
    const { data: wsClass, error: classErr } = await clients.owner
      .from('workspaces')
      .insert({ name: 'Security Audit Classroom', type: 'classroom', owner_id: users.owner.id })
      .select('*')
      .single();
    if (classErr) throw classErr;
    classroomWorkspace = wsClass;

    // Add members using adminClient in harness only
    await adminClient.from('workspace_members').insert([
      // Team members
      { workspace_id: teamWorkspace.id, user_id: users.admin.id, role: 'admin' },
      { workspace_id: teamWorkspace.id, user_id: users.studentA.id, role: 'contributor' },
      { workspace_id: teamWorkspace.id, user_id: users.viewer.id, role: 'viewer' },
      // Classroom members
      { workspace_id: classroomWorkspace.id, user_id: users.admin.id, role: 'admin' },
      { workspace_id: classroomWorkspace.id, user_id: users.studentA.id, role: 'contributor' },
      { workspace_id: classroomWorkspace.id, user_id: users.studentB.id, role: 'contributor' },
      { workspace_id: classroomWorkspace.id, user_id: users.viewer.id, role: 'viewer' },
    ]);

    // Student A creates repo in Classroom
    const { data: repoA, error: repoErr } = await clients.studentA
      .from('repositories')
      .insert({
        workspace_id: classroomWorkspace.id,
        name: 'student-a-project',
        created_by: users.studentA.id,
      })
      .select('*')
      .single();
    if (repoErr) throw repoErr;
    studentARepo = repoA;

    // Student A creates a file
    await clients.studentA.from('repository_files').insert({
      repository_id: studentARepo.id,
      name: 'solution.py',
      content: 'print("Student A secret solution")',
    });

    // Owner creates an assignment
    const { data: asgn, error: asgnErr } = await clients.owner
      .from('assignments')
      .insert({
        workspace_id: classroomWorkspace.id,
        title: 'Midterm Coding Assessment',
        created_by: users.owner.id,
        max_points: 100,
      })
      .select('*')
      .single();
    if (asgnErr) throw asgnErr;
    assignment = asgn;

    // Student A submits
    const { data: sub, error: subErr } = await clients.studentA
      .from('submissions')
      .insert({
        assignment_id: assignment.id,
        student_id: users.studentA.id,
        repository_id: studentARepo.id,
        status: 'submitted',
      })
      .select('*')
      .single();
    if (subErr) throw subErr;
    submissionA = sub;
  });

  after(async () => {
    if (adminClient && users) {
      for (const u of Object.values(users)) {
        try {
          await adminClient.auth.admin.deleteUser(u.id);
        } catch {}
      }
    }
  });

  test('1. Prove: anon cannot read or write ANY table', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const tables = [
      'workspaces', 'workspace_members', 'repositories', 'repository_files',
      'branches', 'commits', 'commit_files', 'assignments', 'submissions',
      'grades', 'activities', 'notifications', 'pull_requests', 'repository_stars', 'profiles'
    ];

    for (const table of tables) {
      const { data } = await anonClient.from(table).select('*').limit(1);
      assert.ok(data === null || data.length === 0, `Anon should not read ${table}`);

      const { error: insertError } = await anonClient.from(table).insert({});
      assert.ok(insertError !== null, `Anon insert on ${table} must be rejected`);
    }
  });

  test('2. Prove: anon cannot call any RPC', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error: err1 } = await anonClient.rpc('join_workspace', { code: 'TEAM-TEST' });
    assert.ok(err1 !== null, 'Anon must not execute join_workspace');

    const { error: err2 } = await anonClient.rpc('list_workspace_members', { workspace_id: teamWorkspace.id });
    assert.ok(err2 !== null, 'Anon must not execute list_workspace_members');

    const { error: err3 } = await anonClient.rpc('notify_workspace_members', {
      workspace_id: teamWorkspace.id,
      title: 'Spam',
    });
    assert.ok(err3 !== null, 'Anon must not execute notify_workspace_members');
  });

  test('3. Prove: outsider cannot see workspaces, join codes or members', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { data: ws } = await clients.outsider
      .from('workspaces')
      .select('id, name, join_code')
      .eq('id', teamWorkspace.id);
    assert.equal(ws.length, 0, 'Outsider must not see private workspaces or join codes');

    const { data: members } = await clients.outsider
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', teamWorkspace.id);
    assert.equal(members.length, 0, 'Outsider must not see workspace members');
  });

  test('4. Prove: non-member cannot call list_workspace_members', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error } = await clients.outsider.rpc('list_workspace_members', {
      workspace_id: teamWorkspace.id,
    });
    assert.ok(error?.message?.includes('Access denied'), 'Non-member must be denied list_workspace_members');
  });

  test('5. Prove: contributor cannot call notify_workspace_members', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error } = await clients.studentA.rpc('notify_workspace_members', {
      workspace_id: teamWorkspace.id,
      title: 'Announcement',
    });
    assert.ok(error?.message?.includes('Permission denied'), 'Contributor must not call notify_workspace_members');
  });

  test('6. Prove: admin cannot change workspaces.owner_id or type', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error: errOwner } = await clients.admin
      .from('workspaces')
      .update({ owner_id: users.admin.id })
      .eq('id', teamWorkspace.id);
    assert.ok(errOwner !== null, 'Admin changing owner_id must be blocked by trigger');

    const { error: errType } = await clients.admin
      .from('workspaces')
      .update({ type: 'classroom' })
      .eq('id', teamWorkspace.id);
    assert.ok(errType !== null, 'Admin changing type must be blocked by trigger');
  });

  test('7. Prove: contributors and viewers cannot read other users profile email', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    // 1. Direct query on profiles is own-row only
    const { data: profile } = await clients.studentA
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', users.studentB.id);
    assert.equal(profile.length, 0, 'Direct select on another user profile must return 0 rows');

    // 2. list_workspace_members RPC returns NULL email for non-staff
    const { data: memberList } = await clients.studentA.rpc('list_workspace_members', {
      workspace_id: classroomWorkspace.id,
    });
    assert.ok(memberList.length > 0);
    for (const m of memberList) {
      assert.equal(m.email, null, 'Email must be NULL when queried by contributor or viewer');
    }

    // 3. list_workspace_members RPC DOES return email for owner/admin
    const { data: staffMemberList } = await clients.owner.rpc('list_workspace_members', {
      workspace_id: classroomWorkspace.id,
    });
    const studentEntry = staffMemberList.find((m) => m.user_id === users.studentA.id);
    assert.ok(studentEntry?.email !== null, 'Owner must be able to view member email');
  });

  test('8. Prove: student submission automatically creates staff notifications', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    // Check notifications for owner and admin
    const { data: ownerNotifs } = await clients.owner
      .from('notifications')
      .select('*')
      .eq('type', 'submission_received');
    assert.ok(ownerNotifs.length > 0, 'Owner must receive notification on student submission');

    const { data: adminNotifs } = await clients.admin
      .from('notifications')
      .select('*')
      .eq('type', 'submission_received');
    assert.ok(adminNotifs.length > 0, 'Admin must receive notification on student submission');
  });

  test('9. Prove: in classroom workspace, viewer has no repo access and Student B cannot see Student A repo', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    // Viewer in classroom
    const { data: viewerRepos } = await clients.viewer
      .from('repositories')
      .select('*')
      .eq('workspace_id', classroomWorkspace.id);
    assert.equal(viewerRepos.length, 0, 'Viewer has no repo read access in classroom workspace');

    const { error: viewerCreateErr } = await clients.viewer
      .from('repositories')
      .insert({
        workspace_id: classroomWorkspace.id,
        name: 'viewer-illegal',
        created_by: users.viewer.id,
      });
    assert.ok(viewerCreateErr !== null, 'Viewer cannot create repo in classroom workspace');

    // Student B cannot see Student A's repo or files
    const { data: repoB } = await clients.studentB
      .from('repositories')
      .select('*')
      .eq('id', studentARepo.id);
    assert.equal(repoB.length, 0, 'Student B cannot see Student A repo in classroom');

    const { data: filesB } = await clients.studentB
      .from('repository_files')
      .select('*')
      .eq('repository_id', studentARepo.id);
    assert.equal(filesB.length, 0, 'Student B cannot see Student A files in classroom');
  });

  test('10. Prove: nobody can set a member role to owner', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    // Admin attempting to promote anyone to owner
    const { error: errAdmin } = await clients.admin
      .from('workspace_members')
      .update({ role: 'owner' })
      .eq('workspace_id', teamWorkspace.id)
      .eq('user_id', users.studentA.id);
    assert.ok(errAdmin !== null, 'Admin must not promote to owner');

    // Even owner cannot update role to owner (prevents unauthorized co-ownership)
    const { error: errOwner } = await clients.owner
      .from('workspace_members')
      .update({ role: 'owner' })
      .eq('workspace_id', teamWorkspace.id)
      .eq('user_id', users.studentA.id);
    assert.ok(errOwner !== null, 'Owner update role to owner must be rejected by RLS check');
  });

  test('11. Prove: self-insert as owner fails', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error } = await clients.outsider
      .from('workspace_members')
      .insert({
        workspace_id: teamWorkspace.id,
        user_id: users.outsider.id,
        role: 'owner',
      });
    assert.ok(error !== null, 'Self-inserting as owner must be rejected by RLS');
  });

  test('12. Prove: student cannot change grade or feedback', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error } = await clients.studentA
      .from('submissions')
      .update({ grade: 100, feedback: 'Tampered' })
      .eq('id', submissionA.id);
    assert.ok(error !== null, 'Student tampering with grade must be blocked by trigger');
  });

  test('13. Prove: contributor can write in a team workspace', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { data: repo, error: repoErr } = await clients.studentA
      .from('repositories')
      .insert({
        workspace_id: teamWorkspace.id,
        name: 'team-collab-repo',
        created_by: users.studentA.id,
      })
      .select('*')
      .single();
    assert.equal(repoErr, null);

    const { error: fileErr } = await clients.studentA
      .from('repository_files')
      .insert({
        repository_id: repo.id,
        name: 'team_code.py',
        content: 'print("team code")',
      });
    assert.equal(fileErr, null, 'Contributor should write files in team workspace');
  });

  test('14. Prove: join_workspace rate limiting and identical errors', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error: err1 } = await clients.outsider.rpc('join_workspace', { code: 'INVALID-CODE-999' });
    assert.ok(err1?.message?.includes('Invalid workspace code.'));

    let rateLimited = false;
    for (let i = 0; i < 11; i++) {
      const { error } = await clients.outsider.rpc('join_workspace', { code: `FAKE-${i}` });
      if (error?.message?.includes('Too many join attempts')) {
        rateLimited = true;
        break;
      }
    }
    assert.ok(rateLimited, 'User must be rate limited after 10 join attempts');
  });

  test('15. Prove: direct notification insert fails and activity spoofing fails', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error: notifErr } = await clients.studentA
      .from('notifications')
      .insert({
        user_id: users.studentB.id,
        type: 'spam',
        title: 'Unsolicited Spam',
      });
    assert.ok(notifErr !== null, 'Direct notification insert must fail under RLS');

    const { error: spoofErr } = await clients.studentA
      .from('activities')
      .insert({
        actor_id: users.owner.id,
        workspace_id: teamWorkspace.id,
        type: 'spoof',
      });
    assert.ok(spoofErr !== null, 'Spoofed activity actor_id must fail');
  });
});


