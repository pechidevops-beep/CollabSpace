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
