-- Supabase Security Advisor Equivalent Checks
-- Run this in SQL Editor to audit RLS status, unrestricted policies, and exposed functions.

-- ============================================================================
-- 1. TABLES WITHOUT ROW LEVEL SECURITY ENABLED
-- Expected: 0 rows
-- ============================================================================
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;

-- ============================================================================
-- 2. POLICIES WITH UNRESTRICTED 'true' QUALIFIERS
-- Expected: Only profiles_select (authenticated users viewing profile cards), NO public/anon true policies!
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true')
  AND 'anon' = ANY (roles);

-- ============================================================================
-- 3. FUNCTIONS EXECUTABLE BY anon
-- Expected: 0 rows (all anon execute revoked)
-- ============================================================================
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'app_private')
  AND has_function_privilege('anon', p.oid, 'EXECUTE');

-- ============================================================================
-- 4. TABLES ACCESSIBLE BY anon
-- Expected: 0 rows
-- ============================================================================
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'anon'
  AND table_schema = 'public';
