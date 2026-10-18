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
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_join_code_format_check;
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
