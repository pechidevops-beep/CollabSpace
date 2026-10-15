import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_TEST_URL || process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe('Phase D: Supabase RLS & Role Matrix Security Tests', () => {
  let adminClient;
  let anonClient;
  let users = {};
  let clients = {};
  let teamWorkspace;
  let classroomWorkspace;
  let studentARepo;
  let assignment;
  let submissionA;

  before(async (t) => {
    if (!SERVICE_ROLE_KEY) {
      t.diagnostic('Skipping live DB tests: SUPABASE_SERVICE_ROLE_KEY is not set in environment.');
      t.diagnostic('To run against your test project, run:');
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

      // Sign in client
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: sessionData, error: signinError } = await userClient.auth.signInWithPassword({
        email,
        password,
      });
      if (signinError) throw signinError;
      clients[r] = userClient;
    }

    // 1. Create Team Workspace (owned by 'owner')
    const { data: wsTeam, error: teamErr } = await clients.owner
      .from('workspaces')
      .insert({ name: 'Security-Audit-Team', type: 'team', owner_id: users.owner.id })
      .select('*')
      .single();
    if (teamErr) throw teamErr;
    teamWorkspace = wsTeam;

    // 2. Create Classroom Workspace (owned by 'owner')
    const { data: wsClass, error: classErr } = await clients.owner
      .from('workspaces')
      .insert({ name: 'Security-Audit-Classroom', type: 'classroom', owner_id: users.owner.id })
      .select('*')
      .single();
    if (classErr) throw classErr;
    classroomWorkspace = wsClass;

    // Add members using adminClient (in harness only)
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
      'grades', 'activities', 'notifications', 'pull_requests', 'repository_stars'
    ];

    for (const table of tables) {
      const { data, error } = await anonClient.from(table).select('*').limit(1);
      assert.ok(data === null || data.length === 0, `Anon should not read ${table}`);

      const { error: insertError } = await anonClient.from(table).insert({});
      assert.ok(insertError !== null, `Anon insert on ${table} must be rejected`);
    }
  });

  test('2. Prove: outsider cannot see workspaces, join codes or members', async (t) => {
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

  test('3. Prove: self-insert as owner fails', async (t) => {
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

  test('4. Prove: student cannot change grade or feedback', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error } = await clients.studentA
      .from('submissions')
      .update({ grade: 100, feedback: 'Tampered' })
      .eq('id', submissionA.id);
    assert.ok(error !== null, 'Student tampering with grade must be blocked by trigger');
  });

  test('5. Prove: in classroom workspace, Student B cannot see Student A repo, files, commits, or submission', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { data: repo } = await clients.studentB
      .from('repositories')
      .select('*')
      .eq('id', studentARepo.id);
    assert.equal(repo.length, 0, 'Student B cannot see Student A repo in classroom');

    const { data: files } = await clients.studentB
      .from('repository_files')
      .select('*')
      .eq('repository_id', studentARepo.id);
    assert.equal(files.length, 0, 'Student B cannot see Student A files in classroom');

    const { data: sub } = await clients.studentB
      .from('submissions')
      .select('*')
      .eq('id', submissionA.id);
    assert.equal(sub.length, 0, 'Student B cannot see Student A submission');
  });

  test('6. Prove: contributor can write in a team workspace', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    // Create repo in team workspace
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

  test('7. Prove: viewer cannot write in workspace', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error } = await clients.viewer
      .from('repositories')
      .insert({
        workspace_id: teamWorkspace.id,
        name: 'viewer-illegal-repo',
        created_by: users.viewer.id,
      });
    assert.ok(error !== null, 'Viewer must not be permitted to create repositories');
  });

  test('8. Prove: admin can create assignments and grade submissions', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { data: asgn, error: asgnErr } = await clients.admin
      .from('assignments')
      .insert({
        workspace_id: classroomWorkspace.id,
        title: 'Admin Created Assignment',
        created_by: users.admin.id,
        max_points: 50,
      })
      .select('*')
      .single();
    assert.equal(asgnErr, null, 'Admin can create assignments');

    const { error: gradeErr } = await clients.admin
      .from('grades')
      .upsert({
        submission_id: submissionA.id,
        grade: 95,
        feedback: 'Excellent implementation',
        grader_id: users.admin.id,
      });
    assert.equal(gradeErr, null, 'Admin can grade submissions');
  });

  test('9. Prove: join_workspace rate limiting and identical errors', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    // Identical error for non-existent code
    const { error: err1 } = await clients.outsider.rpc('join_workspace', { code: 'INVALID-CODE-999' });
    assert.ok(err1?.message?.includes('Invalid workspace code.'));

    // Rapid attempts trigger rate limiting (max 10)
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

  test('10. Prove: direct notification insert fails', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    const { error } = await clients.studentA
      .from('notifications')
      .insert({
        user_id: users.studentB.id,
        type: 'spam',
        title: 'Unsolicited Spam',
      });
    assert.ok(error !== null, 'Direct notification insert by client must be blocked by RLS');
  });

  test('11. Prove: activity spoofing fails', async (t) => {
    if (!SERVICE_ROLE_KEY) return t.skip('Requires live test environment credentials');

    // Spoofing actor_id
    const { error: err1 } = await clients.studentA
      .from('activities')
      .insert({
        actor_id: users.owner.id,
        workspace_id: teamWorkspace.id,
        type: 'spoof',
      });
    assert.ok(err1 !== null, 'Activity insert with spoofed actor_id must fail');

    // Spoofing workspace_id (not a member)
    const { error: err2 } = await clients.outsider
      .from('activities')
      .insert({
        actor_id: users.outsider.id,
        workspace_id: teamWorkspace.id,
        type: 'spoof',
      });
    assert.ok(err2 !== null, 'Activity insert in non-member workspace must fail');
  });
});
