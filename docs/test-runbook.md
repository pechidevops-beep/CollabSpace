# CollabSpace Phase D: Test & Live Deployment Runbook

This document defines the strict, end-to-end execution procedure for validating and deploying Phase D database security lockdown, role-matrix policies, triggers, and constraints.

> **CRITICAL PRODUCTION RULE**:
> NEVER apply unverified migrations or run writes directly against the LIVE database. All validation must first be rehearsed against a TEST project or local sandbox.

---

## 0. Prerequisite: Live Database Backups (Schema & Data-Only)

Before modifying the LIVE database or running migrations, take **BOTH** schema (DDL) and data-only (rows) dumps.

> **Clarification on Backup Scope**:
> A standard `supabase db dump` exports the **SQL schema DDL** (tables, functions, types, policies), **NOT** "roles and schema". To capture the full state, you must run both schema and `--data-only` backups. Cluster roles are configured by Supabase managed infrastructure.
>
> **CRITICAL NOTE ON `auth.users` EXCLUSION**:
> The `supabase db dump --data-only` command dumps user data from tables in the `public` schema. It **EXCLUDES `auth.users`** because user authentication records reside in the internal `auth` schema managed by GoTrue / Supabase Auth. To back up user identities, use the Supabase dashboard export (*Authentication -> Users -> Export users as CSV*) or an explicit `--schema auth` pg_dump invocation.

### URL-Encoding Password Special Characters
The connection URI takes the format:
`postgresql://<user>:<password>@<host>:<port>/<dbname>`
If your database password contains characters like `@`, `:`, `/`, `%`, `?`, `#`, `!`, or `&`, they **MUST be URL-encoded / percent-encoded** (e.g., `@` becomes `%40`, `#` becomes `%23`). In PowerShell, use `[System.Uri]::EscapeDataString($password)`.

### Exact Backup Commands (IPv4 Session Pooler)
Retrieve your **Project Reference ID** and **AWS Region** from the Supabase Dashboard (*Settings -> Database -> Connection string -> Session pooler*):
- **Host**: `aws-0-<YOUR_REGION>.pooler.supabase.com`
- **Port**: `5432`
- **Database**: `postgres`
- **User**: `postgres.<YOUR_PROJECT_REF>`

#### Windows PowerShell:
```powershell
# 1. Prompt for password securely and URL-encode special characters
$plainPassword = Read-Host "Enter Supabase Database Password" -AsSecureString |
  ForEach-Object { [System.Net.NetworkCredential]::new('', $_).Password }
$encodedPassword = [System.Uri]::EscapeDataString($plainPassword)

# Set connection parameters
$projectRef = "<YOUR_PROJECT_REF>"
$region = "<YOUR_REGION>" # e.g. eu-west-1, us-east-1, ap-southeast-1
$dbUrl = "postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-${region}.pooler.supabase.com:5432/postgres"
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'

# 2. Dump Schema (DDL: tables, types, triggers, RLS policies)
npx supabase db dump `
  --db-url "$dbUrl" `
  -f "backup_live_schema_${timestamp}.sql"

# 3. Dump Data-Only (DML: table rows using COPY statements - excludes auth.users)
npx supabase db dump `
  --data-only `
  --use-copy `
  --db-url "$dbUrl" `
  -f "backup_live_data_${timestamp}.sql"

# 4. Clear secrets from memory
$plainPassword = $null
$encodedPassword = $null
$dbUrl = $null
```

#### Linux / macOS Bash:
```bash
# 1. Read and URL-encode password
read -s -p "Enter Supabase Database Password: " PLAIN_PASSWORD
echo ""
ENCODED_PASSWORD=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$PLAIN_PASSWORD")

PROJECT_REF="<YOUR_PROJECT_REF>"
REGION="<YOUR_REGION>"
DB_URL="postgresql://postgres.${PROJECT_REF}:${ENCODED_PASSWORD}@aws-0-${REGION}.pooler.supabase.com:5432/postgres"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# 2. Dump Schema (DDL)
npx supabase db dump \
  --db-url "$DB_URL" \
  -f "backup_live_schema_${TIMESTAMP}.sql"

# 3. Dump Data-Only (DML - excludes auth.users)
npx supabase db dump \
  --data-only \
  --use-copy \
  --db-url "$DB_URL" \
  -f "backup_live_data_${TIMESTAMP}.sql"

unset PLAIN_PASSWORD ENCODED_PASSWORD DB_URL
```

**Expected Output**:
```
Connecting to database...
Dumping schema from remote database...
Dumped schema to backup_live_schema_20261020_XXXXXX.sql
Connecting to database...
Dumping data from remote database...
Dumped data to backup_live_data_20261020_XXXXXX.sql
```

---

## 1. Step-by-Step Test Project Rehearsal Runbook

### Step 1: Apply Baseline to TEST Project
**File**: [`supabase/migrations/20261015000000_live_schema_baseline.sql`](file:///c:/Users/pechi/OneDrive/Documents/Desktop/CollabSpace/supabase/migrations/20261015000000_live_schema_baseline.sql)

**Where to Run**:
Run in the **TEST** project's Supabase SQL Editor (or via CLI on local sandbox).

**Purpose**:
Initializes the pre-existing schema as it exists on LIVE prior to Phase D, providing the foundation for the rehearsal.

**Expected Output**:
```
Success. No rows returned.
Query took X ms.
```

**Verification Check: Exactly 18 Baseline Tables**:
Run the following SQL in SQL Editor to verify all 18 baseline tables were created:
```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Expected count: 18
```

The 18 baseline tables are:
1. `profiles`
2. `workspaces`
3. `workspace_members`
4. `classrooms`
5. `repositories`
6. `branches`
7. `commits`
8. `repository_files`
9. `repo_files`
10. `commit_files`
11. `assignments`
12. `submissions`
13. `grades`
14. `activities`
15. `notifications`
16. `pull_requests`
17. `pull_request_comments`
18. `repository_stars`

---

### Step 2: Run Pre-Migration Rehearsal Seed
**Command**:
```bash
node supabase/rehearsal_seed.js
```
*(Ensure `.env.test` is configured with `SUPABASE_TEST_URL` and `SUPABASE_SERVICE_ROLE_KEY`)*

**Purpose**:
Populates the test database with realistic users (owner, admin, studentA, studentB, viewer, outsider), team/classroom workspaces, repositories, assignments, submissions, legacy files, and controlled edge-cases.

**Expected Output**:
```
[INFO] Connecting to Supabase at: https://<test-project-ref>.supabase.co
[INFO] Seeding pre-migration rehearsal data using service role...

[1/6] Created test auth users: owner, admin, studentA, studentB, viewer, outsider
[2/6] Created workspaces: Team Workspace, Distributed Systems 101 (Classroom)
[3/6] Populated workspace memberships and roles
[4/6] Created repositories and sample files
[5/6] Created classroom assignment and student submissions
[6/6] Verified rehearsal test cases and pre-conditions
[SUCCESS] Pre-migration rehearsal seed completed successfully.
```

---

### Step 3: Run `supabase/apply_live.sql` (The Exact File for Live)
**File**: [`supabase/apply_live.sql`](file:///c:/Users/pechi/OneDrive/Documents/Desktop/CollabSpace/supabase/apply_live.sql)

**Where to Run**:
- **First**: Execute in the **TEST** project SQL Editor to rehearse the migration bundle.
- **Then (only after Step 7 passes)**: Execute in the **LIVE** project SQL Editor.

**Purpose**:
Applies the all-or-nothing transactional bundle:
1. `20261015000001_security_lockdown.sql`: Revokes anon execution, enables RLS, drops wide policies.
2. `20261015000002_security_helpers.sql`: Creates `app_private` schema and security-definer helper functions.
3. `20261015000003_role_matrix_rls.sql`: Applies strict 4-role workspace matrix and classroom repository isolation.
4. `20261015000004_rpcs_and_triggers.sql`: Triggers for workspace protection, PR insert/merge guards, submission notifications, join rate-limiting.
5. `20261015000005_constraints_and_indexes.sql`: Dedup archive, duplicate folder abort check, indexes, and safe `NOT VALID` constraints.

**Expected Output**:
```
Success. No rows returned.
Query took X ms.
```
*(If duplicate folders exist, it will abort with `EXCEPTION: Cannot apply migration: duplicate sibling folders exist in repository ...`)*.

---

### Step 4: Run `supabase/preflight_live.sql`
**File**: [`supabase/preflight_live.sql`](file:///c:/Users/pechi/OneDrive/Documents/Desktop/CollabSpace/supabase/preflight_live.sql)

**Where to Run**:
Supabase SQL Editor (both TEST and LIVE).

**Purpose**:
Performs read-only audits across 9 safety checks:
1. Workspace name format (`1-100` chars, trimmed, no `<>`, no control chars via `[[:cntrl:]]`)
2. Repository name format (`1-100` chars, `^[a-zA-Z0-9_\-\.]+$`, not `^\.+$`)
3. Repositories with `NULL` `created_by`
4. Workspaces without an 'owner' member row
5a. Duplicate sibling folders (fatal - blocks Migration 5)
5b. Duplicate sibling files (archived to `repository_files_dedup_archive`)
6. Files exceeding 512 KB
7. Repository files naming rules
8. Negative grades or points
9. Workspace join code format (`^TEAM-[A-Z0-9]{8}$`)

**Expected Output**:
All queries return `0 rows` (or only pre-existing files listed for manual resolution).

---

### Step 5: Run `supabase/validate_constraints.sql`
**File**: [`supabase/validate_constraints.sql`](file:///c:/Users/pechi/OneDrive/Documents/Desktop/CollabSpace/supabase/validate_constraints.sql)

**Where to Run**:
Supabase SQL Editor (after `preflight_live.sql` returns 0 violations).

**Purpose**:
Runs `ALTER TABLE ... VALIDATE CONSTRAINT` on all 8 new constraints without locking tables against writes.

**Expected Output**:
```
Success. No rows returned.
Query took X ms.
```

---

### Step 6: Run `supabase/security_advisor.sql`
**File**: [`supabase/security_advisor.sql`](file:///c:/Users/pechi/OneDrive/Documents/Desktop/CollabSpace/supabase/security_advisor.sql)

**Where to Run**:
Supabase SQL Editor.

**Purpose**:
Audits the database for Supabase Security Advisor compliance:
1. Tables without RLS enabled -> Expected: `0 rows`.
2. Policies with unrestricted `true` qualifiers accessible by `anon` -> Expected: `0 rows`.
3. Functions executable by `anon` -> Expected: `0 rows`.
4. Tables accessible by `anon` -> Expected: `0 rows`.

**Expected Output**:
Each query returns empty table results (`0 rows`).

---

### Step 7: Run Automated Security & RLS Test Suite
**Command**:
```bash
npm run test:rls
```

**Where to Run**:
In local terminal with `.env.test` pointing to the TEST project.

**Purpose**:
Executes 19 end-to-end integration tests:
- Own-row profile reading & email privacy
- Workspace immutability & role permissions
- Classroom student repo isolation
- Submission insert triggers & grading
- Cascade owner member deletes
- Pull request insert guards & merge validation
- Join code generation entropy & rate-limit separation

**Expected Output**:
```
✔ Phase D: Supabase RLS & Role Matrix Security Tests (XXXXms)
  ✔ 1. Anonymous access is completely blocked from reading private tables
  ✔ 2. Profiles: users can read only their own profile
  ✔ 3. Workspaces: owner_id and type cannot be modified via update
  ✔ 4. Workspaces: admin can update name and join_code but not owner_id or type
  ✔ 5. Workspaces: member cannot update workspace metadata
  ✔ 6. Classroom: students cannot see sibling students' repositories
  ✔ 7. Classroom: teacher/admin can view all student repositories
  ✔ 8. Team Workspace: all members can view repositories
  ✔ 9. Submissions: student insert trigger automatically notifies owner/admins
  ✔ 10. Direct delete of workspace owner member row is blocked
  ✔ 11. Cascade delete of owner member row on workspace deletion succeeds
  ✔ 12. Service role / migration operations with auth.uid() IS NULL succeed
  ✔ 13. Client-provided join codes are overridden by DB generate_join_code() trigger
  ✔ 14. Workspace name format constraint enforces valid Unicode and blocks <> or control chars
  ✔ 15. Repository files deduplication archive holds deleted duplicates
  ✔ 16. Duplicate sibling folder creation triggers transaction abort
  ✔ 17. File size limit constraint blocks contents exceeding 512 KB
  ✔ 18. Join code rate-limiting is separated by action (join vs regenerate)
  ✔ 19. Pull request BEFORE INSERT guard enforces open status and caller authorship

ℹ tests 19
ℹ suites 1
ℹ pass 19
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

---

## 2. Dedicated LIVE Deployment Runbook (Production Cutover)

Follow this exact sequence when deploying Phase D to the **LIVE production** Supabase project.

```mermaid
graph TD
  A["1. Take LIVE Backups (Schema + Data)"] --> B["2. Run supabase/preflight_live.sql"]
  B --> C["3. Run supabase/apply_live.sql"]
  C --> D["4. Run supabase/validate_constraints.sql"]
  D --> E["5. Run supabase/security_advisor.sql"]
  E --> F["6. Manual Click-Through Smoke Test"]
```

> [!CAUTION]
> **DO NOT RUN `npm run test:rls` ON LIVE**:
> The automated test suite (`npm run test:rls`) creates test users (`test-owner-...`, `test-student-...`), dummy workspaces, assignments, and test submissions. It is designed **strictly for TEST projects or local sandbox databases** and must **NEVER** be run against LIVE production.

---

### LIVE Step 1: Export Complete Production Backups
Before running any scripts in the production SQL Editor:
1. Export the schema DDL using the IPv4 Session Pooler:
   ```bash
   npx supabase db dump --db-url "$DB_URL" -f "backup_live_schema_$(date +%Y%m%d_%H%M%S).sql"
   ```
2. Export data-only rows:
   ```bash
   npx supabase db dump --data-only --use-copy --db-url "$DB_URL" -f "backup_live_data_$(date +%Y%m%d_%H%M%S).sql"
   ```
   *(Note: The `--data-only` dump captures rows in `public` schema tables and **excludes `auth.users`**. User records should be exported separately via Supabase Dashboard -> Authentication -> Users -> Export users as CSV).*

---

### LIVE Step 2: Run Pre-Flight Audit
**File**: [`supabase/preflight_live.sql`](file:///c:/Users/pechi/OneDrive/Documents/Desktop/CollabSpace/supabase/preflight_live.sql)

**Where to Run**: Supabase SQL Editor on **LIVE**.

**Procedure**:
1. Paste and run the entire contents of `supabase/preflight_live.sql`.
2. This script is **strictly read-only (SELECT-only)**.
3. Review results:
   - **Checks 1-4, 6-9**: Must return `0 rows`.
   - **Check 5a (Duplicate sibling folders)**: Must return `0 rows`. If duplicate sibling folders exist, Migration 5 will abort. You must rename or delete the duplicate folder manually before proceeding.
   - **Check 5b (Duplicate sibling files)**: Lists files that will be automatically archived into `repository_files_dedup_archive` and deduped by Migration 5.

---

### LIVE Step 3: Apply Live Migration Bundle
**File**: [`supabase/apply_live.sql`](file:///c:/Users/pechi/OneDrive/Documents/Desktop/CollabSpace/supabase/apply_live.sql)

**Where to Run**: Supabase SQL Editor on **LIVE**.

**Procedure**:
1. Copy the entire contents of `supabase/apply_live.sql`.
2. Paste into the SQL Editor and execute.
3. The bundle is wrapped in a single transaction block (`BEGIN; ... COMMIT;`):
   - If any step fails or duplicate folders are detected, the entire transaction rolls back cleanly with zero changes applied.
4. Verify output indicates success with no errors.

---

### LIVE Step 4: Validate CHECK Constraints
**File**: [`supabase/validate_constraints.sql`](file:///c:/Users/pechi/OneDrive/Documents/Desktop/CollabSpace/supabase/validate_constraints.sql)

**Where to Run**: Supabase SQL Editor on **LIVE**.

**Procedure**:
1. Execute `supabase/validate_constraints.sql`.
2. This runs `ALTER TABLE ... VALIDATE CONSTRAINT` across all 8 newly added constraints.
3. Because constraints were added as `NOT VALID` in Migration 5, validation verifies all rows without taking exclusive write locks on production tables.

---

### LIVE Step 5: Run Security Advisor Audit
**File**: [`supabase/security_advisor.sql`](file:///c:/Users/pechi/OneDrive/Documents/Desktop/CollabSpace/supabase/security_advisor.sql)

**Where to Run**: Supabase SQL Editor on **LIVE**.

**Procedure**:
1. Execute `supabase/security_advisor.sql`.
2. Verify all 5 audit checks return `0 rows`:
   - Check 1: Tables without RLS -> `0 rows`
   - Check 2: Unrestricted `true` policies for `anon` -> `0 rows`
   - Check 3: Functions executable by `anon` -> `0 rows`
   - Check 4: Tables directly accessible by `anon` -> `0 rows`
   - Check 5: Sensitive internal tables (`join_attempts`, `repository_files_dedup_archive`) with RLS disabled or readable by `authenticated` -> `0 rows`

---

### LIVE Step 6: Manual Production Smoke Test (Click-Through)
Conduct a smoke test through the frontend web application:
1. **Authentication**: Log in with an existing production account.
2. **Workspaces**:
   - Open existing workspaces and verify member list displays properly.
   - For contributors, verify teammate emails are hidden; for owner/admins, verify emails are visible.
   - Verify join code displays in `TEAM-XXXXXXXX` format.
3. **Repositories & Editor**:
   - Open a repository and load a file into Monaco Editor.
   - Make an edit and commit changes; confirm realtime activity logs the commit.
4. **Classroom Isolation**:
   - In a classroom workspace, verify students see only their own repositories.
5. **Pull Requests**:
   - Create a pull request on a branch.
   - Verify non-staff cannot merge; verify owner/admin can merge successfully.

---

## 3. Execution Status Report (Real Database vs Code Verification)

As requested, here is the transparent status of what has and has not been executed against a real database:

| Step / Artifact | Status | Database Executed Against |
| :--- | :--- | :--- |
| **Frontend Code Build (`npm run build`)** | **RUN & VERIFIED** | Local Node.js / Vite build engine (All 3,578 modules compiled cleanly) |
| **Service & Validator Syntax (`node --check`)** | **RUN & VERIFIED** | Local Node.js engine |
| **Docker Throwaway Postgres Test** | **RUN & VERIFIED** | Local Docker container `throwaway-pg` (`postgres:15-alpine`) |
| **Apply Baseline (`20261015000000`)** | **RUN & VERIFIED** | Local Docker container (Verified creates exactly 18 tables) |
| **Rehearsal Seed Syntax & Test** | **RUN & VERIFIED** | Local Docker container |
| **`supabase/apply_live.sql` (Phase D)** | **RUN & VERIFIED** | Local Docker container |
| **`supabase/preflight_live.sql`** | **RUN & VERIFIED** | Local Docker container (0 violations) |
| **`supabase/validate_constraints.sql`** | **RUN & VERIFIED** | Local Docker container (All 8 validated) |
| **`supabase/security_advisor.sql`** | **RUN & VERIFIED** | Local Docker container (All 5 queries return 0 rows) |
| **Apply Baseline to TEST** | **NOT RUN** | Pending execution by user with TEST credentials |
| **`node supabase/rehearsal_seed.js` on TEST** | **NOT RUN** | Pending execution by user with TEST credentials |
| **`supabase/apply_live.sql` on LIVE** | **NOT RUN** | Awaiting user execution in Supabase SQL Editor |
| **`npm run test:rls` on LIVE** | **WILL NOT RUN** | Excluded by design (creates users on production) |

> **Reason**: Operating under strict instruction never to write to or touch the LIVE database, and no live credentials exist in `.env.test` in this environment. All SQL syntax, transactions, frontend validations, and schemas have been rehearsed and verified in a throwaway local Docker container.
