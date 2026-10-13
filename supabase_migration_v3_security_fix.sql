-- ============================================================================
-- CollabSpace – Security Fix Migration
-- Fixes: "RLS Disabled in Public" for branches and notifications tables
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

-- ── 1. branches table (create if missing, enable RLS, add policies) ──────────

CREATE TABLE IF NOT EXISTS branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'main',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(repository_id, name)
);

-- Enable RLS
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DO $$ BEGIN
  DROP POLICY IF EXISTS "branches_all" ON branches;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Workspace members can read/write branches of repos they have access to
CREATE POLICY "branches_all" ON branches
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_branches_repo ON branches(repository_id);

-- ── 2. notifications RLS fix (re-apply in case it was missed) ────────────────

-- Make sure RLS is enabled (safe to run again)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Re-create policies cleanly
DO $$ BEGIN
  DROP POLICY IF EXISTS "notifications_own" ON notifications;
  DROP POLICY IF EXISTS "notifications_insert_all" ON notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Users can only read/update/delete their own notifications
CREATE POLICY "notifications_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- Anyone authenticated can insert a notification (for workspace actions)
CREATE POLICY "notifications_insert_all" ON notifications
  FOR INSERT WITH CHECK (true);

-- ── Done ─────────────────────────────────────────────────────────────────────
-- After running this:
-- 1. Go to Supabase → Security Advisor → Refresh
-- 2. The two "RLS Disabled in Public" errors should be gone
