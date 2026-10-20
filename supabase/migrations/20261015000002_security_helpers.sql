-- Migration: 20261015000002_security_helpers.sql
-- Description: Implement security definer helper functions in private schema with search_path = ''
-- and tighten existing functions.

-- ============================================================================
-- 1. CREATE PRIVATE SCHEMA
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS app_private;

REVOKE ALL ON SCHEMA app_private FROM public, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;

-- ============================================================================
-- 2. HELPER FUNCTIONS IN app_private
-- ============================================================================

-- Get member role in workspace
CREATE OR REPLACE FUNCTION app_private.workspace_role(
  _workspace_id UUID,
  _user_id UUID DEFAULT auth.uid()
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT wm.role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = _workspace_id
    AND wm.user_id = _user_id
  LIMIT 1;
$$;

-- Check if user is member of workspace
CREATE OR REPLACE FUNCTION app_private.is_workspace_member(
  _workspace_id UUID,
  _user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _user_id
  );
$$;

-- Check if user has one of the specified roles in workspace
CREATE OR REPLACE FUNCTION app_private.is_workspace_role(
  _workspace_id UUID,
  _roles TEXT[],
  _user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _user_id
      AND wm.role = ANY (_roles)
  );
$$;

-- Helper: can user read repository?
-- Rules:
-- team workspace: all 4 roles (owner, admin, contributor, viewer) read all repos
-- classroom workspace: contributor reads only repos they created; owner and admin read all; viewer none
CREATE OR REPLACE FUNCTION app_private.can_read_repo(
  _repo_id UUID,
  _user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_workspace_id UUID;
  v_created_by UUID;
  v_ws_type TEXT;
  v_role TEXT;
BEGIN
  IF _repo_id IS NULL OR _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT r.workspace_id, r.created_by, w.type, wm.role
  INTO v_workspace_id, v_created_by, v_ws_type, v_role
  FROM public.repositories r
  JOIN public.workspaces w ON w.id = r.workspace_id
  JOIN public.workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = _user_id
  WHERE r.id = _repo_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_ws_type = 'team' THEN
    RETURN v_role = ANY (ARRAY['owner'::text, 'admin'::text, 'contributor'::text, 'viewer'::text]);
  ELSIF v_ws_type = 'classroom' THEN
    IF v_role = ANY (ARRAY['owner'::text, 'admin'::text]) THEN
      RETURN TRUE;
    ELSIF v_role = 'contributor' THEN
      RETURN v_created_by = _user_id;
    ELSE
      RETURN FALSE;
    END IF;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

-- Helper: can user write repository?
-- Rules:
-- team workspace: owner, admin, contributor write; viewer read-only
-- classroom workspace: contributor writes only repos they created; owner and admin write; viewer none
CREATE OR REPLACE FUNCTION app_private.can_write_repo(
  _repo_id UUID,
  _user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_workspace_id UUID;
  v_created_by UUID;
  v_ws_type TEXT;
  v_role TEXT;
BEGIN
  IF _repo_id IS NULL OR _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT r.workspace_id, r.created_by, w.type, wm.role
  INTO v_workspace_id, v_created_by, v_ws_type, v_role
  FROM public.repositories r
  JOIN public.workspaces w ON w.id = r.workspace_id
  JOIN public.workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = _user_id
  WHERE r.id = _repo_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_ws_type = 'team' THEN
    RETURN v_role = ANY (ARRAY['owner'::text, 'admin'::text, 'contributor'::text]);
  ELSIF v_ws_type = 'classroom' THEN
    IF v_role = ANY (ARRAY['owner'::text, 'admin'::text]) THEN
      RETURN TRUE;
    ELSIF v_role = 'contributor' THEN
      RETURN v_created_by = _user_id;
    ELSE
      RETURN FALSE;
    END IF;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

-- ============================================================================
-- 3. HARDEN EXISTING FUNCTIONS (search_path = '' & REVOKE FROM public, anon)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = coalesce(excluded.email, public.profiles.email);
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.set_repo_files_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Revoke execution from public & anon
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.set_repo_files_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_repo_files_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_workspace_role(uuid, text[], uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_workspace_role(uuid, text[], uuid) FROM anon;

-- Grant execution on app_private helpers to authenticated only
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO authenticated;

-- Ensure future functions in app_private do not inherit execute for PUBLIC or anon
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private GRANT EXECUTE ON FUNCTIONS TO authenticated;
