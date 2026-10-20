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
  content TEXT,
  is_folder BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Deduplication (Item 2):
-- If duplicate FOLDERS exist (is_folder = true), RAISE EXCEPTION and abort transaction.
-- For duplicate FILES (is_folder IS NOT TRUE), copy to archive table first, then delete.
DO $$
DECLARE
  v_dup_folders TEXT;
  v_dup_files_count INT := 0;
BEGIN
  -- A. Check for duplicate FOLDERS (is_folder = true)
  SELECT string_agg(
    format('repo=%s branch=%s parent=%s name="%s" (count=%s)',
           repository_id,
           coalesce(branch_id::text, 'null'),
           coalesce(parent_id::text, 'null'),
           name,
           count(*)),
    E'\n  '
  )
  INTO v_dup_folders
  FROM public.repository_files
  WHERE is_folder = true
  GROUP BY repository_id, branch_id, parent_id, name
  HAVING count(*) > 1;

  IF v_dup_folders IS NOT NULL THEN
    RAISE EXCEPTION E'Migration 5 aborted: Duplicate sibling FOLDERS detected. Manual resolution required:\n  %', v_dup_folders;
  END IF;

  -- B. Copy duplicate FILES (is_folder IS NOT TRUE) to repository_files_dedup_archive
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
      WHERE coalesce(is_folder, false) = false
    ) t
    WHERE t.rnum > 1
  ),
  archived AS (
    INSERT INTO public.repository_files_dedup_archive (
      id, repository_id, branch_id, parent_id, name, content, is_folder, created_at, updated_at
    )
    SELECT
      rf.id, rf.repository_id, rf.branch_id, rf.parent_id, rf.name, rf.content, rf.is_folder, rf.created_at, rf.updated_at
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

-- Repository file names: strict ASCII, no path separators or traversal segments (1-100 chars, no control chars via [[:cntrl:]]) (Item 3)
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
