-- ============================================================================
-- PRE-FLIGHT AUDIT SCRIPT FOR LIVE DATABASE (READ-ONLY)
-- ============================================================================
-- Run this entire script in Supabase SQL Editor BEFORE applying migrations.
-- It executes SELECT-only queries to check if any existing rows violate the
-- new constraints, orphaned states, or naming rules.
--
-- If any query returns rows, review and resolve those rows before validation.
-- ============================================================================

-- 1. Check workspace names
-- Criteria: 1-100 characters, alphanumeric, spaces, hyphens, underscores, dots
-- Note: "My Workspace" is completely valid.
SELECT
  'INVALID WORKSPACE NAME' AS check_name,
  id,
  name,
  owner_id,
  created_at
FROM public.workspaces
WHERE name IS NULL
   OR char_length(name) < 1
   OR char_length(name) > 100
   OR name !~ '^[a-zA-Z0-9_\-\. ]+$';

-- 2. Check repository names
-- Criteria: 1-100 characters, alphanumeric, hyphens, underscores, dots (no spaces)
SELECT
  'INVALID REPOSITORY NAME' AS check_name,
  id,
  name,
  workspace_id,
  created_at
FROM public.repositories
WHERE name IS NULL
   OR char_length(name) < 1
   OR char_length(name) > 100
   OR name !~ '^[a-zA-Z0-9_\-\.]+$';

-- 3. Check repositories with NULL created_by
-- (Important for classroom repository isolation)
SELECT
  'NULL REPO CREATED_BY' AS check_name,
  id,
  name,
  workspace_id,
  created_at
FROM public.repositories
WHERE created_by IS NULL;

-- 4. Check workspaces with no corresponding 'owner' membership row
SELECT
  'WORKSPACE WITHOUT OWNER MEMBER ROW' AS check_name,
  w.id AS workspace_id,
  w.name AS workspace_name,
  w.owner_id
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.workspace_id = w.id
    AND wm.user_id = w.owner_id
    AND wm.role = 'owner'
);

-- 5. Check duplicate sibling file names in repository_files
-- (Must be unique within repository + branch + parent folder)
SELECT
  'DUPLICATE SIBLING FILES' AS check_name,
  repository_id,
  COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid) AS branch_id,
  COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid) AS parent_id,
  name,
  count(*) AS duplicate_count
FROM public.repository_files
GROUP BY
  repository_id,
  COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  name
HAVING count(*) > 1;

-- 6. Check files exceeding 512 KB (524,288 bytes)
SELECT
  'FILE EXCEEDS 512KB' AS check_name,
  id,
  repository_id,
  name,
  octet_length(content) AS size_bytes
FROM public.repository_files
WHERE octet_length(content) > 524288;

-- 7. Check file names violating safePath rules
-- (Cannot contain '/', '\', '.', '..', control characters, or exceed 100 chars)
SELECT
  'UNSAFE FILE NAME' AS check_name,
  id,
  repository_id,
  name
FROM public.repository_files
WHERE name LIKE '%/%'
   OR name LIKE '%\%'
   OR name = '.'
   OR name = '..'
   OR name ~ '[\x00-\x1f\x7f]'
   OR char_length(name) < 1
   OR char_length(name) > 100;

-- 8. Check negative grades or invalid assignment max_points
SELECT
  'NEGATIVE SUBMISSION GRADE' AS check_name,
  id,
  assignment_id,
  student_id,
  grade
FROM public.submissions
WHERE grade < 0;

SELECT
  'NEGATIVE GRADE RECORD' AS check_name,
  id,
  submission_id,
  grade
FROM public.grades
WHERE grade < 0;

SELECT
  'INVALID ASSIGNMENT MAX POINTS' AS check_name,
  id,
  workspace_id,
  title,
  max_points
FROM public.assignments
WHERE max_points <= 0;
