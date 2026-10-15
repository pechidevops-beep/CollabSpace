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
