-- ============================================================================
-- CollabSpace – Phase 4 Repository System Upgrade
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Depends on: supabase_migration.sql, supabase_migration_v2.sql, v3
-- ============================================================================

-- ============================================================================
-- 1) Repositories: fork metadata + UI stats + default branch
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repositories' AND column_name = 'parent_repository_id') THEN
    ALTER TABLE repositories ADD COLUMN parent_repository_id UUID REFERENCES repositories(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repositories' AND column_name = 'is_fork') THEN
    ALTER TABLE repositories ADD COLUMN is_fork BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repositories' AND column_name = 'default_branch') THEN
    ALTER TABLE repositories ADD COLUMN default_branch TEXT DEFAULT 'main';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repositories' AND column_name = 'stars_count') THEN
    ALTER TABLE repositories ADD COLUMN stars_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repositories' AND column_name = 'forks_count') THEN
    ALTER TABLE repositories ADD COLUMN forks_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repositories' AND column_name = 'size_bytes') THEN
    ALTER TABLE repositories ADD COLUMN size_bytes BIGINT DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_repositories_parent ON repositories(parent_repository_id);

-- ============================================================================
-- 2) Repo files: add metadata needed for file viewer
-- ============================================================================
DO $$
BEGIN
  -- repo_files (legacy name)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'repo_files') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repo_files' AND column_name = 'size_bytes') THEN
      ALTER TABLE repo_files ADD COLUMN size_bytes BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repo_files' AND column_name = 'last_modified_at') THEN
      ALTER TABLE repo_files ADD COLUMN last_modified_at TIMESTAMPTZ DEFAULT now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repo_files' AND column_name = 'author_id') THEN
      ALTER TABLE repo_files ADD COLUMN author_id UUID REFERENCES auth.users(id);
    END IF;
  END IF;

  -- repository_files (current name used by app)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'repository_files') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repository_files' AND column_name = 'size_bytes') THEN
      ALTER TABLE repository_files ADD COLUMN size_bytes BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repository_files' AND column_name = 'last_modified_at') THEN
      ALTER TABLE repository_files ADD COLUMN last_modified_at TIMESTAMPTZ DEFAULT now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repository_files' AND column_name = 'author_id') THEN
      ALTER TABLE repository_files ADD COLUMN author_id UUID REFERENCES auth.users(id);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3) Commit files: track added/removed/modified for diff viewer
-- ============================================================================
CREATE TABLE IF NOT EXISTS commit_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  commit_id UUID NOT NULL REFERENCES commits(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('added', 'removed', 'modified')),
  diff TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Handle legacy schemas where commit_files may exist with repo_id instead of repository_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commit_files' AND column_name = 'repo_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commit_files' AND column_name = 'repository_id') THEN
    ALTER TABLE commit_files ADD COLUMN repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE;
    UPDATE commit_files SET repository_id = repo_id WHERE repository_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_commit_files_commit ON commit_files(commit_id);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commit_files' AND column_name = 'repository_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_commit_files_repo ON commit_files(repository_id)';
  END IF;
END $$;

-- ============================================================================
-- 4) Branches: add latest_commit_id for fast history lookup
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'latest_commit_id') THEN
    ALTER TABLE branches ADD COLUMN latest_commit_id UUID REFERENCES commits(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 5) Pull requests + reviews/comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS pull_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  source_branch TEXT NOT NULL,
  target_branch TEXT NOT NULL DEFAULT 'main',
  title TEXT NOT NULL,
  description TEXT,
  author_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'merged', 'closed')),
  merged_by UUID REFERENCES auth.users(id),
  merged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Handle legacy schemas where pull_requests may exist with repo_id instead of repository_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pull_requests' AND column_name = 'repo_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pull_requests' AND column_name = 'repository_id') THEN
    ALTER TABLE pull_requests ADD COLUMN repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE;
    UPDATE pull_requests SET repository_id = repo_id WHERE repository_id IS NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pull_request_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pull_requests' AND column_name = 'repository_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pr_repo ON pull_requests(repository_id)';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_pr_status ON pull_requests(status);
CREATE INDEX IF NOT EXISTS idx_pr_comments_pr ON pull_request_comments(pull_request_id);

-- ============================================================================
-- 6) Stars (optional but needed for UI stats)
-- ============================================================================
CREATE TABLE IF NOT EXISTS repository_stars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(repository_id, user_id)
);

-- Handle legacy schemas where repository_stars may exist with repo_id instead of repository_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repository_stars' AND column_name = 'repo_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repository_stars' AND column_name = 'repository_id') THEN
    ALTER TABLE repository_stars ADD COLUMN repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE;
    UPDATE repository_stars SET repository_id = repo_id WHERE repository_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repository_stars' AND column_name = 'repository_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_repo_stars_repo ON repository_stars(repository_id)';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_repo_stars_user ON repository_stars(user_id);

-- ============================================================================
-- 7) RLS (permissive for now, tighten later)
-- ============================================================================
ALTER TABLE commit_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_stars ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "commit_files_all" ON commit_files;
  DROP POLICY IF EXISTS "pull_requests_all" ON pull_requests;
  DROP POLICY IF EXISTS "pull_request_comments_all" ON pull_request_comments;
  DROP POLICY IF EXISTS "repository_stars_all" ON repository_stars;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "commit_files_all" ON commit_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pull_requests_all" ON pull_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pull_request_comments_all" ON pull_request_comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "repository_stars_all" ON repository_stars FOR ALL USING (true) WITH CHECK (true);

-- Done! Repo system schema extended for branches, commits, PRs, stars, and forks.
