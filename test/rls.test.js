import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 1. Load .env.test via dotenv
const testEnvPath = path.resolve(process.cwd(), '.env.test');
if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath, override: true });
}

// 2. Read .env to compare URLs and prevent accidental runs against production
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
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 3. REFUSE TO RUN if test URL equals production URL
if (prodUrl && SUPABASE_URL) {
  const normTest = SUPABASE_URL.trim().toLowerCase().replace(/\/$/, '');
  const normProd = prodUrl.trim().toLowerCase().replace(/\/$/, '');
  if (normTest === normProd) {
    throw new Error(
      `CRITICAL SAFETY ABORT: SUPABASE_TEST_URL (${SUPABASE_URL}) equals the production URL in .env (${prodUrl}). Tests must ONLY run against a dedicated test database.`
    );
  }
}

describe('Phase D: Supabase RLS & Role Matrix Security Tests', () => {
  let adminClient;
  let anonClient;
  const users = {};
  const clients = {};
  let teamWorkspace;
  let classroomWorkspace;
  let studentARepo;
  let assignment;
  let submissionA;

  before(async (t) => {
    if (!SERVICE_ROLE_KEY) {
      t.diagnostic('Skipping live DB tests: SUPABASE_SERVICE_ROLE_KEY is not set in environment.');
      t.diagnostic('To run against your test project:');
      t.diagnostic('  $env:SUPABASE_SERVICE_ROLE_KEY="<your-test-service-role-key>"; npm run test:rls');
      return;
    }

    adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const roles = ['owner', 'admin', 'studentA', 'studentB', 'viewer', 'outsider'];
    for (const r of roles) {
      const email = `test_${r}_${Date.now()}@testcollabspace.internal`;
      const password = 'TestSecurePassword123!';
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `Test User ${r}` },
      });
      if (error) throw error;
      users[r] = data.user;

      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: signinError } = await userClient.auth.signInWithPassword({
        email,
        password,
      });
      if (signinError) throw signinError;
      clients[r] = userClient;
    }

    // 1. Create Team Workspace (owned by 'owner')
    const { data: wsTeam, error: teamErr } = await clients.owner
      .from('workspaces')
      .insert({ name: 'Security Audit Team', type: 'team', owner_id: users.owner.id })
      .select('*')
      .single();
    if (teamErr) throw teamErr;
    teamWorkspace = wsTeam;

    // 2. Create Classroom Workspace (owned by 'owner')
    const { data: wsClass, error: classErr } = await clients.owner
      .from('workspaces')
      .insert({ name: 'Security Audit Classroom', type: 'classroom', owner_id: users.owner.id })
      .select('*')
      .single();
    if (classErr) throw classErr;
    classroomWorkspace = wsClass;

    // Add members using adminClient in harness only
    await adminClient.from('workspace_members').insert([
      // Team members
      { workspace_id: teamWorkspace.id, user_id: users.admin.id, role: 'admin' },
      { workspace_id: teamWorkspace.id, user_id: users.studentA.id, role: 'contributor' },
      { workspace_id: teamWorkspace.id, user_id: users.viewer.id, role: 'viewer' },
      // Classroom members
      { workspace_id: classroomWorkspace.id, user_id: users.admin.id, role: 'admin' },
      { workspace_id: classroomWorkspace.id, user_id: users.studentA.id, role: 'contributor' },
      { workspace_id: classroomWorkspace.id, user_id: users.studentB.id, role: 'contributor' },
      { workspace_id: classroomWorkspace.id, user_id: users.viewer.id, role: 'viewer' },
    ]);

    // Student A creates repo in Classroom
    const { data: repoA, error: repoErr } = await clients.studentA
      .from('repositories')
      .insert({
        workspace_id: classroomWorkspace.id,
        name: 'student-a-project',
        created_by: users.studentA.id,
      })
      .select('*')
      .single();
    if (repoErr) throw repoErr;
    studentARepo = repoA;

    // Student A creates a file
    await clients.studentA.from('repository_files').insert({
      repository_id: studentARepo.id,
      name: 'solution.py',
      content: 'print("Student A secret solution")',
    });

    // Owner creates an assignment
    const { data: asgn, error: asgnErr } = await clients.owner
      .from('assignments')
      .insert({
        workspace_id: classroomWorkspace.id,
        title: 'Midterm Coding Assessment',
        created_by: users.owner.id,
        max_points: 100,
      })
      .select('*')
      .single();
    if (asgnErr) throw asgnErr;
    assignment = asgn;

    // Student A submits
    const { data: sub, error: subErr } = await clients.studentA
      .from('submissions')
      .insert({
        assignment_id: assignment.id,
        student_id: users.studentA.id,
        repository_id: studentARepo.id,
        status: 'submitted',
      })
      .select('*')
      .single();
    if (subErr) throw subErr;
    submissionA = sub;
  });

  after(async () => {
    if (adminClient && users) {
      for (const u of Object.values(users)) {
        try {
          await adminClient.auth.admin.deleteUser(u.id);
        } catch {}
      }
    }
  });

  test('1. Prove: anon cannot read or write ANY table', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const tables = [
      'workspaces', 'workspace_members', 'repositories', 'repository_files',
      'branches', 'commits', 'commit_files', 'assignments', 'submissions',
      'grades', 'activities', 'notifications', 'pull_requests', 'repository_stars', 'profiles'
    ];

    for (const table of tables) {
      const { data } = await anonClient.from(table).select('*').limit(1);
      assert.ok(data === null || data.length === 0, `Anon should not read ${table}`);

      const { error: insertError } = await anonClient.from(table).insert({});
      assert.ok(insertError !== null, `Anon insert on ${table} must be rejected`);
    }
  });

  test('2. Prove: anon cannot call any RPC', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error: err1 } = await anonClient.rpc('join_workspace', { code: 'TEAM-TEST' });
    assert.ok(err1 !== null, 'Anon must not execute join_workspace');

    const { error: err2 } = await anonClient.rpc('list_workspace_members', { workspace_id: teamWorkspace.id });
    assert.ok(err2 !== null, 'Anon must not execute list_workspace_members');

    const { error: err3 } = await anonClient.rpc('notify_workspace_members', {
      workspace_id: teamWorkspace.id,
      title: 'Spam',
    });
    assert.ok(err3 !== null, 'Anon must not execute notify_workspace_members');
  });

  test('3. Prove: outsider cannot see workspaces, join codes or members', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { data: ws } = await clients.outsider
      .from('workspaces')
      .select('id, name, join_code')
      .eq('id', teamWorkspace.id);
    assert.equal(ws.length, 0, 'Outsider must not see private workspaces or join codes');

    const { data: members } = await clients.outsider
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', teamWorkspace.id);
    assert.equal(members.length, 0, 'Outsider must not see workspace members');
  });

  test('4. Prove: non-member cannot call list_workspace_members', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error } = await clients.outsider.rpc('list_workspace_members', {
      workspace_id: teamWorkspace.id,
    });
    assert.ok(error?.message?.includes('Access denied'), 'Non-member must be denied list_workspace_members');
  });

  test('5. Prove: contributor cannot call notify_workspace_members', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error } = await clients.studentA.rpc('notify_workspace_members', {
      workspace_id: teamWorkspace.id,
      title: 'Announcement',
    });
    assert.ok(error?.message?.includes('Permission denied'), 'Contributor must not call notify_workspace_members');
  });

  test('6. Prove: admin cannot change workspaces.owner_id or type', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error: errOwner } = await clients.admin
      .from('workspaces')
      .update({ owner_id: users.admin.id })
      .eq('id', teamWorkspace.id);
    assert.ok(errOwner !== null, 'Admin changing owner_id must be blocked by trigger');

    const { error: errType } = await clients.admin
      .from('workspaces')
      .update({ type: 'classroom' })
      .eq('id', teamWorkspace.id);
    assert.ok(errType !== null, 'Admin changing type must be blocked by trigger');
  });

  test('7. Prove: contributors and viewers cannot read other users profile email', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    // 1. Direct query on profiles is own-row only
    const { data: profile } = await clients.studentA
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', users.studentB.id);
    assert.equal(profile.length, 0, 'Direct select on another user profile must return 0 rows');

    // 2. list_workspace_members RPC returns NULL email for non-staff
    const { data: memberList } = await clients.studentA.rpc('list_workspace_members', {
      workspace_id: classroomWorkspace.id,
    });
    assert.ok(memberList.length > 0);
    for (const m of memberList) {
      assert.equal(m.email, null, 'Email must be NULL when queried by contributor or viewer');
    }

    // 3. list_workspace_members RPC DOES return email for owner/admin
    const { data: staffMemberList } = await clients.owner.rpc('list_workspace_members', {
      workspace_id: classroomWorkspace.id,
    });
    const studentEntry = staffMemberList.find((m) => m.user_id === users.studentA.id);
    assert.ok(studentEntry?.email !== null, 'Owner must be able to view member email');
  });

  test('8. Prove: student submission automatically creates staff notifications', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    // Check notifications for owner and admin
    const { data: ownerNotifs } = await clients.owner
      .from('notifications')
      .select('*')
      .eq('type', 'submission_received');
    assert.ok(ownerNotifs.length > 0, 'Owner must receive notification on student submission');

    const { data: adminNotifs } = await clients.admin
      .from('notifications')
      .select('*')
      .eq('type', 'submission_received');
    assert.ok(adminNotifs.length > 0, 'Admin must receive notification on student submission');
  });

  test('9. Prove: in classroom workspace, viewer has no repo access and Student B cannot see Student A repo', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    // Viewer in classroom
    const { data: viewerRepos } = await clients.viewer
      .from('repositories')
      .select('*')
      .eq('workspace_id', classroomWorkspace.id);
    assert.equal(viewerRepos.length, 0, 'Viewer has no repo read access in classroom workspace');

    const { error: viewerCreateErr } = await clients.viewer
      .from('repositories')
      .insert({
        workspace_id: classroomWorkspace.id,
        name: 'viewer-illegal',
        created_by: users.viewer.id,
      });
    assert.ok(viewerCreateErr !== null, 'Viewer cannot create repo in classroom workspace');

    // Student B cannot see Student A's repo or files
    const { data: repoB } = await clients.studentB
      .from('repositories')
      .select('*')
      .eq('id', studentARepo.id);
    assert.equal(repoB.length, 0, 'Student B cannot see Student A repo in classroom');

    const { data: filesB } = await clients.studentB
      .from('repository_files')
      .select('*')
      .eq('repository_id', studentARepo.id);
    assert.equal(filesB.length, 0, 'Student B cannot see Student A files in classroom');
  });

  test('10. Prove: nobody can set a member role to owner', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    // Admin attempting to promote anyone to owner
    const { error: errAdmin } = await clients.admin
      .from('workspace_members')
      .update({ role: 'owner' })
      .eq('workspace_id', teamWorkspace.id)
      .eq('user_id', users.studentA.id);
    assert.ok(errAdmin !== null, 'Admin must not promote to owner');

    // Even owner cannot update role to owner (prevents unauthorized co-ownership)
    const { error: errOwner } = await clients.owner
      .from('workspace_members')
      .update({ role: 'owner' })
      .eq('workspace_id', teamWorkspace.id)
      .eq('user_id', users.studentA.id);
    assert.ok(errOwner !== null, 'Owner update role to owner must be rejected by RLS check');
  });

  test('11. Prove: self-insert as owner fails', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error } = await clients.outsider
      .from('workspace_members')
      .insert({
        workspace_id: teamWorkspace.id,
        user_id: users.outsider.id,
        role: 'owner',
      });
    assert.ok(error !== null, 'Self-inserting as owner must be rejected by RLS');
  });

  test('12. Prove: student cannot change grade or feedback', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error } = await clients.studentA
      .from('submissions')
      .update({ grade: 100, feedback: 'Tampered' })
      .eq('id', submissionA.id);
    assert.ok(error !== null, 'Student tampering with grade must be blocked by trigger');
  });

  test('13. Prove: contributor can write in a team workspace', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { data: repo, error: repoErr } = await clients.studentA
      .from('repositories')
      .insert({
        workspace_id: teamWorkspace.id,
        name: 'team-collab-repo',
        created_by: users.studentA.id,
      })
      .select('*')
      .single();
    assert.equal(repoErr, null);

    const { error: fileErr } = await clients.studentA
      .from('repository_files')
      .insert({
        repository_id: repo.id,
        name: 'team_code.py',
        content: 'print("team code")',
      });
    assert.equal(fileErr, null, 'Contributor should write files in team workspace');
  });

  test('14. Prove: join_workspace rate limiting and identical errors', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error: err1 } = await clients.outsider.rpc('join_workspace', { code: 'INVALID-CODE-999' });
    assert.ok(err1?.message?.includes('Invalid workspace code.'));

    let rateLimited = false;
    for (let i = 0; i < 11; i++) {
      const { error } = await clients.outsider.rpc('join_workspace', { code: `FAKE-${i}` });
      if (error?.message?.includes('Too many join attempts')) {
        rateLimited = true;
        break;
      }
    }
    assert.ok(rateLimited, 'User must be rate limited after 10 join attempts');
  });

  test('15. Prove: direct notification insert fails and activity spoofing fails', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error: notifErr } = await clients.studentA
      .from('notifications')
      .insert({
        user_id: users.studentB.id,
        type: 'spam',
        title: 'Unsolicited Spam',
      });
    assert.ok(notifErr !== null, 'Direct notification insert must fail under RLS');

    const { error: spoofErr } = await clients.studentA
      .from('activities')
      .insert({
        actor_id: users.owner.id,
        workspace_id: teamWorkspace.id,
        type: 'spoof',
      });
    assert.ok(spoofErr !== null, 'Spoofed activity actor_id must fail');
  });
});
