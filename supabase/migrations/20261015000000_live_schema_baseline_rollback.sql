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
