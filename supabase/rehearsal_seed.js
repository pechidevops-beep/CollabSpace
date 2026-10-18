// supabase/rehearsal_seed.js
// Seeds realistic test/rehearsal data against the TEST Supabase project
// Run AFTER the live schema baseline and BEFORE migrations 1-5.
//
// Usage:
//   node supabase/rehearsal_seed.js

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 1. Load .env.test if present
const testEnvPath = path.resolve(process.cwd(), '.env.test');
if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath, override: true });
}

// 2. Load .env to prevent accidental execution against live/production
const prodEnvPath = path.resolve(process.cwd(), '.env');
let prodUrl = null;
if (fs.existsSync(prodEnvPath)) {
  const prodEnvContent = fs.readFileSync(prodEnvPath, 'utf8');
  const match = prodEnvContent.match(/VITE_SUPABASE_URL\s*=\s*([^\r\n#]+)/);
  if (match) {
    prodUrl = match[1].trim().replace(/^["']|["']$/g, '');
  }
}

const SUPABASE_URL = process.env.SUPABASE_TEST_URL || process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('\x1b[31m[ERROR]\x1b[0m SUPABASE_SERVICE_ROLE_KEY is required to run the rehearsal seed.');
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY in .env.test or your environment.');
  process.exit(1);
}

// Safety check: refuse if test URL matches production
if (prodUrl && SUPABASE_URL) {
  const normTest = SUPABASE_URL.trim().toLowerCase().replace(/\/$/, '');
  const normProd = prodUrl.trim().toLowerCase().replace(/\/$/, '');
  if (normTest === normProd) {
    console.error(`\x1b[31m[SAFETY ABORT]\x1b[0m SUPABASE_TEST_URL (${SUPABASE_URL}) matches production URL in .env (${prodUrl}).`);
    console.error('The rehearsal seed must NEVER be executed against production.');
    process.exit(1);
  }
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`\x1b[34m[INFO]\x1b[0m Connecting to Supabase at: ${SUPABASE_URL}`);
  console.log('\x1b[34m[INFO]\x1b[0m Seeding pre-migration rehearsal data using service role...\n');

  const timestamp = Date.now();
  const users = {};
  const userRoles = ['owner', 'admin', 'studentA', 'studentB', 'viewer', 'outsider'];

  // 1. Create auth users & profiles
  console.log('1. Creating rehearsal users...');
  for (const role of userRoles) {
    const email = `rehearsal_${role}_${timestamp}@testcollabspace.internal`;
    const password = 'RehearsalPassword2026!';
    const fullName = `Rehearsal ${role.toUpperCase()}`;

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error) {
      throw new Error(`Failed to create user ${email}: ${error.message}`);
    }

    users[role] = data.user;
    console.log(`   - Created ${role}: ${data.user.id} (${email})`);
  }

  // 2. Create workspaces (one named "My Workspace", one classroom)
  console.log('\n2. Creating workspaces...');
  const { data: teamWs, error: teamErr } = await adminClient
    .from('workspaces')
    .insert({
      name: 'My Workspace',
      type: 'team',
      owner_id: users.owner.id,
      join_code: 'TEAM-LEGACY1', // Pre-migration format
    })
    .select('*')
    .single();

  if (teamErr) throw new Error(`Failed to create "My Workspace": ${teamErr.message}`);
  console.log(`   - Created team workspace "My Workspace": ${teamWs.id}`);

  const { data: classroomWs, error: classErr } = await adminClient
    .from('workspaces')
    .insert({
      name: 'CS101 Algorithms & Systems',
      type: 'classroom',
      owner_id: users.owner.id,
      join_code: 'TEAM-LEGACY2', // Pre-migration format
    })
    .select('*')
    .single();

  if (classErr) throw new Error(`Failed to create classroom workspace: ${classErr.message}`);
  console.log(`   - Created classroom workspace: ${classroomWs.id}`);

  // 3. Create workspace memberships
  console.log('\n3. Creating workspace memberships...');
  const members = [
    // Team workspace members
    { workspace_id: teamWs.id, user_id: users.owner.id, role: 'owner' },
    { workspace_id: teamWs.id, user_id: users.admin.id, role: 'admin' },
    { workspace_id: teamWs.id, user_id: users.studentA.id, role: 'contributor' },
    { workspace_id: teamWs.id, user_id: users.viewer.id, role: 'viewer' },
    // Classroom members
    { workspace_id: classroomWs.id, user_id: users.owner.id, role: 'owner' },
    { workspace_id: classroomWs.id, user_id: users.admin.id, role: 'admin' },
    { workspace_id: classroomWs.id, user_id: users.studentA.id, role: 'contributor' },
    { workspace_id: classroomWs.id, user_id: users.studentB.id, role: 'contributor' },
    { workspace_id: classroomWs.id, user_id: users.viewer.id, role: 'viewer' },
  ];

  const { error: memErr } = await adminClient.from('workspace_members').insert(members);
  if (memErr) throw new Error(`Failed to create workspace members: ${memErr.message}`);
  console.log(`   - Inserted ${members.length} membership records.`);

  // 4. Create repositories (including one with created_by NULL)
  console.log('\n4. Creating repositories...');
  const repos = [
    {
      workspace_id: teamWs.id,
      name: 'core-platform',
      description: 'Main platform repository',
      created_by: users.owner.id,
      visibility: 'public',
    },
    {
      workspace_id: teamWs.id,
      name: 'legacy-orphaned-repo',
      description: 'Repository with NULL created_by to test migration handling',
      created_by: null, // Per item 8 requirement: one repo with created_by NULL
      visibility: 'private',
    },
    {
      workspace_id: classroomWs.id,
      name: 'student-a-assignment',
      description: 'Student A assignment repository',
      created_by: users.studentA.id,
      visibility: 'private',
    },
  ];

  const { data: createdRepos, error: repoErr } = await adminClient
    .from('repositories')
    .insert(repos)
    .select('*');

  if (repoErr) throw new Error(`Failed to create repositories: ${repoErr.message}`);
  console.log(`   - Created ${createdRepos.length} repositories (including 1 with created_by NULL).`);

  const studentRepo = createdRepos.find((r) => r.name === 'student-a-assignment');
  const teamRepo = createdRepos.find((r) => r.name === 'core-platform');

  // 5. Create default branches
  console.log('\n5. Creating repository branches...');
  const branches = createdRepos.map((r) => ({
    repository_id: r.id,
    name: 'main',
    is_default: true,
  }));

  const { data: createdBranches, error: branchErr } = await adminClient
    .from('branches')
    .insert(branches)
    .select('*');

  if (branchErr) throw new Error(`Failed to create branches: ${branchErr.message}`);
  console.log(`   - Created ${createdBranches.length} default branches.`);

  const studentBranch = createdBranches.find((b) => b.repository_id === studentRepo.id);
  const teamBranch = createdBranches.find((b) => b.repository_id === teamRepo.id);

  // 6. Create repository files including DUPLICATE SIBLING NAME
  console.log('\n6. Creating repository files (including duplicate sibling)...');
  const files = [
    {
      repository_id: teamRepo.id,
      branch_id: teamBranch.id,
      name: 'README.md',
      content: '# Core Platform\nWelcome to CollabSpace rehearsal test.',
      is_folder: false,
    },
    {
      repository_id: teamRepo.id,
      branch_id: teamBranch.id,
      name: 'index.js',
      content: 'console.log("CollabSpace initialized");',
      is_folder: false,
    },
    // Duplicate sibling file 1
    {
      repository_id: studentRepo.id,
      branch_id: studentBranch.id,
      parent_id: null,
      name: 'duplicate.py',
      content: '# Duplicate file version 1 (older)',
      is_folder: false,
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    },
    // Duplicate sibling file 2 (same repository_id, branch_id, parent_id, name)
    {
      repository_id: studentRepo.id,
      branch_id: studentBranch.id,
      parent_id: null,
      name: 'duplicate.py',
      content: '# Duplicate file version 2 (newer)',
      is_folder: false,
      updated_at: new Date().toISOString(),
    },
  ];

  const { error: fileErr } = await adminClient.from('repository_files').insert(files);
  if (fileErr) throw new Error(`Failed to insert repository files: ${fileErr.message}`);
  console.log('   - Inserted repository files, including duplicate sibling file "duplicate.py".');

  // 7. Create assignment in classroom
  console.log('\n7. Creating classroom assignment...');
  const { data: assignment, error: asgnErr } = await adminClient
    .from('assignments')
    .insert({
      workspace_id: classroomWs.id,
      title: 'Lab 1: Graph Algorithms',
      description: 'Implement BFS and DFS in Python.',
      created_by: users.owner.id,
      max_points: 100,
      due_date: new Date(Date.now() + 86400000 * 7).toISOString(),
    })
    .select('*')
    .single();

  if (asgnErr) throw new Error(`Failed to create assignment: ${asgnErr.message}`);
  console.log(`   - Created assignment: ${assignment.id} ("${assignment.title}")`);

  // 8. Create submissions
  console.log('\n8. Creating student submission...');
  const { data: submission, error: subErr } = await adminClient
    .from('submissions')
    .insert({
      assignment_id: assignment.id,
      student_id: users.studentA.id,
      repository_id: studentRepo.id,
      status: 'submitted',
    })
    .select('*')
    .single();

  if (subErr) throw new Error(`Failed to create submission: ${subErr.message}`);
  console.log(`   - Created submission: ${submission.id}`);

  // 9. Create notifications
  console.log('\n9. Creating notifications...');
  const notifications = [
    {
      user_id: users.owner.id,
      workspace_id: teamWs.id,
      type: 'announcement',
      title: 'Welcome to Rehearsal',
      message: 'Initial rehearsal setup completed.',
    },
    {
      user_id: users.studentA.id,
      workspace_id: classroomWs.id,
      type: 'announcement',
      title: 'Lab 1 Assigned',
      message: 'Please complete Lab 1 before the deadline.',
    },
  ];

  const { error: notifErr } = await adminClient.from('notifications').insert(notifications);
  if (notifErr) throw new Error(`Failed to create notifications: ${notifErr.message}`);
  console.log(`   - Created ${notifications.length} notification records.`);

  // 10. Create activities
  console.log('\n10. Creating activities...');
  const activities = [
    {
      workspace_id: teamWs.id,
      actor_id: users.owner.id,
      type: 'workspace_created',
      message: 'Workspace "My Workspace" created.',
    },
    {
      workspace_id: classroomWs.id,
      actor_id: users.owner.id,
      type: 'assignment_created',
      message: 'Assignment "Lab 1: Graph Algorithms" created.',
    },
    {
      workspace_id: classroomWs.id,
      actor_id: users.studentA.id,
      type: 'submission_created',
      message: 'Student A submitted Lab 1.',
    },
  ];

  const { error: actErr } = await adminClient.from('activities').insert(activities);
  if (actErr) throw new Error(`Failed to create activities: ${actErr.message}`);
  console.log(`   - Created ${activities.length} activity records.`);

  console.log('\n\x1b[32m[SUCCESS]\x1b[0m Rehearsal seed data successfully created on TEST project!');
  console.log('You can now:');
  console.log('  1. Run supabase/preflight_live.sql in the SQL Editor to inspect legacy states.');
  console.log('  2. Apply migrations 1-5 (or supabase/apply_live.sql).');
  console.log('  3. Run supabase/validate_constraints.sql.');
  console.log('  4. Run supabase/security_advisor.sql.');
  console.log('  5. Run npm run test:rls.\n');
}

main().catch((err) => {
  console.error('\n\x1b[31m[FAILED]\x1b[0m Rehearsal seed error:', err.message);
  process.exit(1);
});
