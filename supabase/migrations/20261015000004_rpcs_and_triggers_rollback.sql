-- Rollback for 20261015000004_rpcs_and_triggers.sql

DROP TRIGGER IF EXISTS tr_validate_pull_request_update ON public.pull_requests;
DROP FUNCTION IF EXISTS public.validate_pull_request_update();

DROP TRIGGER IF EXISTS tr_prevent_owner_member_delete ON public.workspace_members;
DROP FUNCTION IF EXISTS public.prevent_owner_member_delete();

DROP TRIGGER IF EXISTS tr_notify_staff_on_submission ON public.submissions;
DROP FUNCTION IF EXISTS public.notify_staff_on_submission();

DROP TRIGGER IF EXISTS tr_validate_workspace_update ON public.workspaces;
DROP FUNCTION IF EXISTS public.validate_workspace_update();

DROP TRIGGER IF EXISTS tr_validate_submission_update ON public.submissions;
DROP FUNCTION IF EXISTS public.validate_submission_update();

DROP FUNCTION IF EXISTS public.cleanup_expired_join_attempts();
DROP FUNCTION IF EXISTS public.notify_workspace_members(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.list_workspace_members(uuid);
DROP FUNCTION IF EXISTS public.join_workspace(text);

DROP FUNCTION IF EXISTS public.regenerate_join_code(uuid);
DROP TABLE IF EXISTS public.join_attempts CASCADE;

DROP TRIGGER IF EXISTS tr_enforce_workspace_join_code ON public.workspaces;
DROP FUNCTION IF EXISTS public.enforce_workspace_join_code();
ALTER TABLE public.workspaces ALTER COLUMN join_code DROP DEFAULT;
DROP FUNCTION IF EXISTS public.generate_join_code();

DROP TRIGGER IF EXISTS tr_workspace_created ON public.workspaces;
DROP FUNCTION IF EXISTS public.handle_workspace_created();

-- Restore original self-insert policies if needed
CREATE POLICY "workspace_members_insert_self" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
