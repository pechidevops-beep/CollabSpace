const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 1. Generate supabase/apply_live.sql
const liveFiles = [
  'supabase/migrations/20261015000001_security_lockdown.sql',
  'supabase/migrations/20261015000002_security_helpers.sql',
  'supabase/migrations/20261015000003_role_matrix_rls.sql',
  'supabase/migrations/20261015000004_rpcs_and_triggers.sql',
  'supabase/migrations/20261015000005_constraints_and_indexes.sql'
];

let applyLive = '-- ============================================================================\n';
applyLive += '-- SUPABASE PHASE D: COMPLETE LIVE MIGRATION BUNDLE (ALL-OR-NOTHING)\n';
applyLive += '-- ============================================================================\n';
applyLive += '-- Execution: Run this entire script in Supabase SQL Editor for your LIVE project.\n';
applyLive += '-- Prerequisite 1: Take a manual backup using: npx supabase db dump --db-url ...\n';
applyLive += '-- Prerequisite 2: Run supabase/preflight_live.sql to verify existing data.\n';
applyLive += '-- ============================================================================\n\n';
applyLive += 'BEGIN;\n\n';

for (const f of liveFiles) {
  const content = fs.readFileSync(path.join(root, f), 'utf8');
  applyLive += `-- >>> START OF ${f} <<<\n`;
  applyLive += content + '\n\n';
}

applyLive += 'COMMIT;\n';
fs.writeFileSync(path.join(root, 'supabase', 'apply_live.sql'), applyLive, 'utf8');
console.log('apply_live.sql created, size:', applyLive.length);

// 2. Generate supabase/review/phase-d-all.sql
const reviewDir = path.join(root, 'supabase', 'review');
if (!fs.existsSync(reviewDir)) {
  fs.mkdirSync(reviewDir, { recursive: true });
}

const allReviewFiles = [
  { label: 'BASELINE MIGRATION (TEST ONLY)', path: 'supabase/migrations/20261015000000_live_schema_baseline.sql' },
  { label: 'BASELINE ROLLBACK', path: 'supabase/migrations/20261015000000_live_schema_baseline_rollback.sql' },
  { label: 'MIGRATION 1: SECURITY LOCKDOWN', path: 'supabase/migrations/20261015000001_security_lockdown.sql' },
  { label: 'ROLLBACK 1: SECURITY LOCKDOWN', path: 'supabase/migrations/20261015000001_security_lockdown_rollback.sql' },
  { label: 'MIGRATION 2: SECURITY HELPERS (APP_PRIVATE)', path: 'supabase/migrations/20261015000002_security_helpers.sql' },
  { label: 'ROLLBACK 2: SECURITY HELPERS', path: 'supabase/migrations/20261015000002_security_helpers_rollback.sql' },
  { label: 'MIGRATION 3: ROLE MATRIX & REPO ISOLATION', path: 'supabase/migrations/20261015000003_role_matrix_rls.sql' },
  { label: 'ROLLBACK 3: ROLE MATRIX & REPO ISOLATION', path: 'supabase/migrations/20261015000003_role_matrix_rls_rollback.sql' },
  { label: 'MIGRATION 4: RPCS & TRIGGERS', path: 'supabase/migrations/20261015000004_rpcs_and_triggers.sql' },
  { label: 'ROLLBACK 4: RPCS & TRIGGERS', path: 'supabase/migrations/20261015000004_rpcs_and_triggers_rollback.sql' },
  { label: 'MIGRATION 5: CONSTRAINTS & INDEXES', path: 'supabase/migrations/20261015000005_constraints_and_indexes.sql' },
  { label: 'ROLLBACK 5: CONSTRAINTS & INDEXES', path: 'supabase/migrations/20261015000005_constraints_and_indexes_rollback.sql' },
  { label: 'PRE-FLIGHT LIVE AUDIT SCRIPT', path: 'supabase/preflight_live.sql' },
  { label: 'VALIDATE CONSTRAINTS SCRIPT', path: 'supabase/validate_constraints.sql' },
  { label: 'SECURITY ADVISOR EQUIVALENT AUDIT QUERIES', path: 'supabase/security_advisor.sql' },
  { label: 'PRE-MIGRATION REHEARSAL SEED SCRIPT', path: 'supabase/rehearsal_seed.js' },
  { label: 'AUTOMATED SECURITY & RLS TEST SUITE', path: 'test/rls.test.js' }
];

let reviewBundle = '-- ============================================================================\n';
reviewBundle += '-- PHASE D MASTER REVIEW BUNDLE\n';
reviewBundle += '-- Contains all migrations, rollbacks, preflight, validation, security advisor, and tests.\n';
reviewBundle += '-- Generated for comprehensive architecture review.\n';
reviewBundle += '-- ============================================================================\n\n';

for (const item of allReviewFiles) {
  const content = fs.readFileSync(path.join(root, item.path), 'utf8');
  reviewBundle += '/******************************************************************************\n';
  reviewBundle += ` * [FILE]: ${item.path}\n`;
  reviewBundle += ` * [DESCRIPTION]: ${item.label}\n`;
  reviewBundle += ' ******************************************************************************/\n\n';
  reviewBundle += content + '\n\n';
}

fs.writeFileSync(path.join(reviewDir, 'phase-d-all.sql'), reviewBundle, 'utf8');
console.log('phase-d-all.sql created, size:', reviewBundle.length);
