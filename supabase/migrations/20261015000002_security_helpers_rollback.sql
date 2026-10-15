-- Rollback for 20261015000002_security_helpers.sql

DROP FUNCTION IF EXISTS app_private.can_write_repo(uuid, uuid);
DROP FUNCTION IF EXISTS app_private.can_read_repo(uuid, uuid);
DROP FUNCTION IF EXISTS app_private.is_workspace_role(uuid, text[], uuid);
DROP FUNCTION IF EXISTS app_private.is_workspace_member(uuid, uuid);
DROP FUNCTION IF EXISTS app_private.workspace_role(uuid, uuid);

DROP SCHEMA IF EXISTS app_private CASCADE;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO public;
GRANT EXECUTE ON FUNCTION public.is_workspace_role(uuid, text[], uuid) TO public;
