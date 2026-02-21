-- ============================================================================
-- CollabSpace – Phase 1 + Phase 2 Database Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- 1. Add new columns to repositories (skip if they already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repositories' AND column_name = 'visibility') THEN
    ALTER TABLE repositories ADD COLUMN visibility TEXT DEFAULT 'public';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repositories' AND column_name = 'language') THEN
    ALTER TABLE repositories ADD COLUMN language TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repositories' AND column_name = 'created_by') THEN
    ALTER TABLE repositories ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repositories' AND column_name = 'last_updated') THEN
    ALTER TABLE repositories ADD COLUMN last_updated TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- 2. Migrate repo_files to hierarchical structure
-- Add new columns (name, type, parent_id) if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repo_files' AND column_name = 'name') THEN
    ALTER TABLE repo_files ADD COLUMN name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repo_files' AND column_name = 'type') THEN
    ALTER TABLE repo_files ADD COLUMN type TEXT DEFAULT 'file' CHECK (type IN ('file', 'folder'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repo_files' AND column_name = 'parent_id') THEN
    ALTER TABLE repo_files ADD COLUMN parent_id UUID REFERENCES repo_files(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repo_files' AND column_name = 'updated_at') THEN
    ALTER TABLE repo_files ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Migrate existing data: extract filename from path (only if path column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repo_files' AND column_name = 'path') THEN
    EXECUTE '
      UPDATE repo_files
      SET name = CASE
        WHEN path LIKE ''%/%'' THEN split_part(path, ''/'', array_length(string_to_array(path, ''/''), 1))
        ELSE path
      END,
      type = CASE WHEN is_dir = true THEN ''folder'' ELSE ''file'' END
      WHERE name IS NULL AND path IS NOT NULL
    ';
  END IF;
END $$;

-- 3. Create commits table
CREATE TABLE IF NOT EXISTS commits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  repository_id UUID REFERENCES repositories(id),
  grade NUMERIC,
  feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

-- 6. Enable RLS (permissive for development – tighten later)
ALTER TABLE commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DO $$ BEGIN
  DROP POLICY IF EXISTS "commits_all" ON commits;
  DROP POLICY IF EXISTS "assignments_all" ON assignments;
  DROP POLICY IF EXISTS "submissions_all" ON submissions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "commits_all" ON commits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "assignments_all" ON assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "submissions_all" ON submissions FOR ALL USING (true) WITH CHECK (true);

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_commits_repo ON commits(repository_id);
CREATE INDEX IF NOT EXISTS idx_assignments_workspace ON assignments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_repo_files_parent ON repo_files(parent_id);
CREATE INDEX IF NOT EXISTS idx_repo_files_repo ON repo_files(repository_id);

-- Done! Your tables are ready for CollabSpace Phase 1 + Phase 2.
