-- ============================================================================
-- VALIDATE CONSTRAINTS SCRIPT FOR LIVE DATABASE
-- ============================================================================
-- Run this script AFTER:
-- 1. preflight_live.sql has reported 0 issues, OR any legacy violations have been corrected.
-- 2. 20261015000005_constraints_and_indexes.sql has applied the constraints as NOT VALID.
--
-- Running VALIDATE verifies all existing rows without acquiring exclusive table write locks.
-- ============================================================================

ALTER TABLE public.workspaces VALIDATE CONSTRAINT workspaces_name_format_check;
ALTER TABLE public.repositories VALIDATE CONSTRAINT repositories_name_format_check;
ALTER TABLE public.repository_files VALIDATE CONSTRAINT repository_files_filename_safe_check;
ALTER TABLE public.repository_files VALIDATE CONSTRAINT repository_files_content_limit_check;
ALTER TABLE public.assignments VALIDATE CONSTRAINT assignments_max_points_positive_check;
ALTER TABLE public.submissions VALIDATE CONSTRAINT submissions_grade_non_negative_check;
ALTER TABLE public.grades VALIDATE CONSTRAINT grades_grade_non_negative_check;
