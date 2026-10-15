-- Migration: 20261015000004_rpcs_and_triggers.sql
-- Description: Implement security definer RPCs (join_workspace, list_workspace_members,
-- notify_workspace_members) and triggers (workspace creator trigger, submissions validation).

-- ============================================================================
-- 1. WORKSPACE CREATOR TRIGGER (AUTO-ADD OWNER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_workspace_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new.id, new.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS tr_workspace_created ON public.workspaces;
CREATE TRIGGER tr_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_workspace_created();

-- Ensure self-insert policies on workspace_members are removed
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_self" ON public.workspace_members;

-- ============================================================================
-- 2. SQL JOIN CODE GENERATOR & REGENERATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_rand bytea;
  v_i int;
  v_idx int;
BEGIN
  LOOP
    v_code := 'TEAM-';
    v_rand := extensions.gen_random_bytes(8);
    FOR v_i IN 0..7 LOOP
      v_idx := (get_byte(v_rand, v_i) % length(v_chars)) + 1;
      v_code := v_code || substr(v_chars, v_idx, 1);
    END LOOP;
    -- Ensure uniqueness across workspaces
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE join_code = v_code) THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.workspaces ALTER COLUMN join_code SET DEFAULT public.generate_join_code();

-- Regenerate ALL existing join codes with high-entropy SQL generator
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.workspaces LOOP
    UPDATE public.workspaces
    SET join_code = public.generate_join_code()
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- ============================================================================
-- 3. RATE-LIMITED JOIN WORKSPACE RPC
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.join_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_join_attempts_user_time ON public.join_attempts (user_id, attempted_at DESC);

ALTER TABLE public.join_attempts ENABLE ROW LEVEL SECURITY;
-- No client policies on join_attempts: access strictly through SECURITY DEFINER RPC

CREATE OR REPLACE FUNCTION public.join_workspace(code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_clean_code TEXT;
  v_recent_attempts INT;
  v_workspace RECORD;
  v_member_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Rate limit: max 10 attempts per 10 minutes per user
  SELECT count(*)
  INTO v_recent_attempts
  FROM public.join_attempts
  WHERE user_id = v_user_id
    AND attempted_at > (now() - interval '10 minutes');

  IF v_recent_attempts >= 10 THEN
    RAISE EXCEPTION 'Too many join attempts. Please try again later.';
  END IF;

  -- Record attempt
  INSERT INTO public.join_attempts (user_id, attempted_at)
  VALUES (v_user_id, now());

  -- 2. Validate format and lookup workspace
  v_clean_code := upper(trim(code));
  IF v_clean_code IS NULL OR length(v_clean_code) < 5 THEN
    RAISE EXCEPTION 'Invalid workspace code.';
  END IF;

  SELECT id, name, owner_id
  INTO v_workspace
  FROM public.workspaces
  WHERE join_code = v_clean_code;

  -- Identical error message for wrong, non-existent, or expired code
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid workspace code.';
  END IF;

  IF v_workspace.owner_id = v_user_id THEN
    RAISE EXCEPTION 'You are the owner of this workspace already.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_workspace.id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You are already a member of this workspace.';
  END IF;

  -- 3. Insert contributor role only
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace.id, v_user_id, 'contributor')
  RETURNING id INTO v_member_id;

  -- 4. Log activity
  INSERT INTO public.activities (type, actor_id, workspace_id, message)
  VALUES ('workspace_joined', v_user_id, v_workspace.id, 'A member joined workspace "' || v_workspace.name || '".');

  RETURN jsonb_build_object(
    'workspace_id', v_workspace.id,
    'workspace_name', v_workspace.name,
    'role', 'contributor'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_workspace(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_workspace(text) TO authenticated;

-- ============================================================================
-- 4. LIST WORKSPACE MEMBERS RPC (EMAIL ONLY FOR OWNER/ADMIN)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_workspace_members(workspace_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  role TEXT,
  joined_date TIMESTAMPTZ,
  email TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT wm.role INTO v_caller_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = list_workspace_members.workspace_id
    AND wm.user_id = v_caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access denied. You are not a member of this workspace.';
  END IF;

  IF v_caller_role = ANY (ARRAY['owner'::text, 'admin'::text]) THEN
    -- Return member profiles WITH email
    RETURN QUERY
    SELECT
      wm.user_id,
      p.full_name,
      wm.role,
      wm.created_at AS joined_date,
      p.email
    FROM public.workspace_members wm
    LEFT JOIN public.profiles p ON p.id = wm.user_id
    WHERE wm.workspace_id = list_workspace_members.workspace_id
    ORDER BY wm.created_at ASC;
  ELSE
    -- Return member profiles WITHOUT email (privacy protected)
    RETURN QUERY
    SELECT
      wm.user_id,
      p.full_name,
      wm.role,
      wm.created_at AS joined_date,
      NULL::TEXT AS email
    FROM public.workspace_members wm
    LEFT JOIN public.profiles p ON p.id = wm.user_id
    WHERE wm.workspace_id = list_workspace_members.workspace_id
    ORDER BY wm.created_at ASC;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.list_workspace_members(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_workspace_members(UUID) TO authenticated;

-- ============================================================================
-- 5. NOTIFY WORKSPACE MEMBERS RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_workspace_members(
  workspace_id UUID,
  title TEXT,
  message TEXT DEFAULT NULL,
  type TEXT DEFAULT 'announcement'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_count INT := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT wm.role INTO v_caller_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = notify_workspace_members.workspace_id
    AND wm.user_id = v_caller_id;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permission denied. Only owners and admins can notify workspace members.';
  END IF;

  INSERT INTO public.notifications (user_id, workspace_id, type, title, message)
  SELECT wm.user_id, notify_workspace_members.workspace_id, notify_workspace_members.type, notify_workspace_members.title, notify_workspace_members.message
  FROM public.workspace_members wm
  WHERE wm.workspace_id = notify_workspace_members.workspace_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_workspace_members(UUID, TEXT, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.notify_workspace_members(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 6. SUBMISSIONS BEFORE UPDATE TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_submission_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_workspace_id UUID;
  v_is_staff BOOLEAN;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Assignment's workspace
  SELECT a.workspace_id INTO v_workspace_id
  FROM public.assignments a
  WHERE a.id = old.assignment_id;

  -- Check if caller is owner or admin in this workspace
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = v_workspace_id
      AND wm.user_id = v_caller_id
      AND wm.role = ANY (ARRAY['owner'::text, 'admin'::text])
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    -- Student caller checks
    IF old.student_id <> v_caller_id THEN
      RAISE EXCEPTION 'Permission denied. Cannot update another student''s submission.';
    END IF;

    -- Cannot tamper with immutable fields
    IF new.student_id <> old.student_id THEN
      RAISE EXCEPTION 'Cannot change student_id of a submission.';
    END IF;

    IF new.assignment_id <> old.assignment_id THEN
      RAISE EXCEPTION 'Cannot change assignment_id of a submission.';
    END IF;

    -- Cannot tamper with grade or feedback
    IF (new.grade IS DISTINCT FROM old.grade) THEN
      RAISE EXCEPTION 'Students are not permitted to change grades.';
    END IF;

    IF (new.feedback IS DISTINCT FROM old.feedback) THEN
      RAISE EXCEPTION 'Students are not permitted to change feedback.';
    END IF;

    -- Status transition: only allow pending -> submitted or submitted -> submitted
    IF new.status <> old.status THEN
      IF NOT (old.status = 'pending' AND new.status = 'submitted') THEN
        RAISE EXCEPTION 'Invalid status change. Students may only submit pending work.';
      END IF;
    END IF;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_submission_update ON public.submissions;
CREATE TRIGGER tr_validate_submission_update
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_submission_update();
