-- ============================================================================
-- CollabSpace – Phase 2 RBAC + Grading + Notifications Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- ============================================================================
-- SPRINT 2: ROLE-BASED ACCESS CONTROL
-- ============================================================================

-- 1. Drop old role check constraint if it exists
DO $$
BEGIN
  ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Migrate existing 'member' roles to 'contributor' FIRST
UPDATE workspace_members SET role = 'contributor' WHERE role = 'member';

-- 3. Add new strict RBAC role constraint (excluding 'member')
DO $$
BEGIN
  ALTER TABLE workspace_members 
    ADD CONSTRAINT workspace_members_role_check 
    CHECK (role IN ('owner', 'admin', 'contributor', 'viewer'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- SPRINT 3: ASSESSMENTS GRADING UPGRADE
-- ============================================================================

-- 3. Add status workflow to submissions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'status') THEN
    ALTER TABLE submissions ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'reviewed', 'returned'));
  END IF;
END $$;

-- 4. Add max_points to assignments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'max_points') THEN
    ALTER TABLE assignments ADD COLUMN max_points NUMERIC DEFAULT 100;
  END IF;
END $$;

-- ============================================================================
-- SPRINT 5: NOTIFICATIONS
-- ============================================================================

-- 5. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Enable RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "notifications_own" ON notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Users can only see their own notifications
CREATE POLICY "notifications_own" ON notifications FOR ALL 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

-- Allow service-role inserts (for triggering notifications)
DO $$ BEGIN
  DROP POLICY IF EXISTS "notifications_insert_all" ON notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "notifications_insert_all" ON notifications FOR INSERT 
  WITH CHECK (true);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Done! RBAC roles, grading workflow, and notifications table are ready.
