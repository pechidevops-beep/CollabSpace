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
