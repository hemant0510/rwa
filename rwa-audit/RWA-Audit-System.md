# RWA-Audit-System.md

# RWA Connect — AI UX Audit System

# Instructions for Claude Code to set up and run everything

---

## WHO THIS FILE IS FOR

You are Claude Code, an agentic AI assistant running inside VS Code.
The human (Hemant) has dropped the `rwa-audit` folder into his RWA Connect project.
Your job is to read this file top to bottom and complete every step autonomously,
asking Hemant only when you genuinely need input you cannot infer yourself.

Do NOT ask for permission before each small action.
Do NOT explain what you are about to do at length — just do it.
After completing each PHASE, print a short summary of what was done and what is next.

---

## CONTEXT: WHAT IS RWA CONNECT

RWA Connect is a multi-tenant SaaS platform for managing Resident Welfare Associations
in India. Hemant is the sole engineer building it.

- **Frontend:** Next.js + TypeScript + Tailwind CSS
- **Backend:** Next.js API routes or separate Node/Express
- **Database:** PostgreSQL with Row Level Security (RLS) for multi-tenancy
- **Auth:** JWT or session-based, multiple roles
- **Roles:** Super Admin, Society Admin, Resident, Security Guard
- **Key modules:** Society onboarding, Resident management, Unit/Flat management,
  Fee collection, Maintenance requests, Visitor management, Notices, Amenity booking

The `rwa-audit` folder contains a Playwright + Claude API audit pipeline.
It crawls the live app, captures screenshots, sends them to Claude for UX analysis,
and produces a prioritised improvement list.

---

## YOUR TASK OVERVIEW

```
PHASE 1 → Verify prerequisites are installed on this machine
PHASE 2 → Install npm dependencies
PHASE 3 → Install Playwright browser
PHASE 4 → Create .env file with correct values
PHASE 5 → Auto-detect RWA Connect routes and update config.ts
PHASE 6 → Auto-detect HTML selectors and update config.ts
PHASE 7 → Run the audit (Playwright crawl)
PHASE 8 → Run the Claude review
PHASE 9 → Run the approval CLI
PHASE 10 → Hand off to Hemant with the generated Claude Code prompt
```

---

## PHASE 1 — VERIFY PREREQUISITES

Run these commands and check the output:

```bash
node --version
npm --version
```

**Expected:** Node 18+ and npm 9+

If Node is below v18, stop and tell Hemant:

> "Please update Node.js to v18 or higher from https://nodejs.org before continuing."

If both are fine, proceed silently to Phase 2.

---

## PHASE 2 — INSTALL NPM DEPENDENCIES

Navigate to the `rwa-audit` folder and install:

```bash
cd rwa-audit
npm install
```

If there are peer dependency warnings, ignore them — they are non-blocking.
If there are actual errors (missing packages, network issues), show Hemant the error.

---

## PHASE 3 — INSTALL PLAYWRIGHT BROWSER

```bash
cd rwa-audit
npx playwright install chromium
```

This downloads a real Chromium browser (~150MB).
It may take 1-2 minutes on first run. Wait for it to complete.

---

## PHASE 4 — CREATE .env FILE

### Step 4a — Check if .env already exists

```bash
ls rwa-audit/.env
```

If it exists, skip to Phase 5. Do not overwrite it.

### Step 4b — Copy from template

```bash
cp rwa-audit/.env.example rwa-audit/.env
```

### Step 4c — Ask Hemant for values

You need these values to fill in the `.env` file.
Ask Hemant ALL of these in a single message (not one at a time):

```
I need the following to complete the .env setup. Please provide all at once:

1. BASE_URL — What URL is RWA Connect running on?
   (e.g. http://localhost:3000 or https://staging.rwaconnect.com)

2. ANTHROPIC_API_KEY — Your Anthropic API key
   (from https://console.anthropic.com — starts with sk-ant-)

3. Super Admin login:
   - Email
   - Password

4. Society Admin login (a real test society admin account):
   - Email
   - Password

5. Resident login (a real test resident account):
   - Email
   - Password

If any role doesn't exist yet in your app, just say SKIP for that role.
```

### Step 4d — Write the .env file

Once Hemant provides the values, write them into `rwa-audit/.env`:

```
BASE_URL=<value from Hemant>
ANTHROPIC_API_KEY=<value from Hemant>
SUPER_ADMIN_EMAIL=<value or skip>
SUPER_ADMIN_PASS=<value or skip>
SOCIETY_ADMIN_EMAIL=<value or skip>
SOCIETY_ADMIN_PASS=<value or skip>
RESIDENT_EMAIL=<value or skip>
RESIDENT_PASS=<value or skip>
```

For any role Hemant said SKIP, comment out those lines with `#`.

---

## PHASE 5 — AUTO-DETECT ROUTES FROM RWA CONNECT

Your goal is to populate `rwa-audit/src/config.ts` with the actual routes
that exist in Hemant's RWA Connect project.

### Step 5a — Find the Next.js app router or pages directory

Look for one of these:

```bash
# App Router (Next.js 13+)
find . -path "*/app/**/page.tsx" -not -path "*/node_modules/*" -not -path "*/rwa-audit/*"

# Pages Router (Next.js 12 and below)
find . -path "*/pages/**/*.tsx" -not -path "*/node_modules/*" -not -path "*/rwa-audit/*"
```

### Step 5b — Extract route paths

From the file paths found, derive the URL routes.
Examples:

- `app/dashboard/page.tsx` → `/dashboard`
- `app/residents/page.tsx` → `/residents`
- `app/residents/[id]/page.tsx` → skip (dynamic routes need IDs)
- `app/(admin)/fees/page.tsx` → `/fees` (strip route groups)
- `pages/residents/index.tsx` → `/residents`

### Step 5c — Map routes to roles

Use these rules to assign routes to roles:

| If the path contains...                                                                                                    | Assign to role                         |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `super-admin`, `superadmin`, `platform`, `all-societies`                                                                   | superAdmin                             |
| `admin`, `society`, `residents`, `units`, `fees`, `maintenance`, `visitors`, `notices`, `amenities`, `reports`, `settings` | societyAdmin                           |
| `resident`, `my-fees`, `my-complaints`, `my-visitors`, `book-amenity`                                                      | resident                               |
| `login`, `register`, `forgot-password`, `reset-password`, `onboarding`                                                     | skip (auth pages, not useful to audit) |
| `api`                                                                                                                      | skip (API routes, not pages)           |
| `_`, `[`                                                                                                                   | skip (private folders, dynamic routes) |

If a path is ambiguous, assign it to `societyAdmin` as the default.

### Step 5d — Update config.ts ROUTES section

Open `rwa-audit/src/config.ts` and replace the ROUTES object with the detected routes.

Example output format:

```typescript
ROUTES: {
  superAdmin: [
    { path: '/dashboard',   label: 'Super Admin Dashboard' },
    { path: '/societies',   label: 'Societies Listing' },
  ],
  societyAdmin: [
    { path: '/dashboard',   label: 'Society Dashboard' },
    { path: '/residents',   label: 'Residents Listing' },
    { path: '/fees',        label: 'Fee Management' },
    // ... all detected routes
  ],
  resident: [
    { path: '/dashboard',   label: 'Resident Dashboard' },
    { path: '/my-fees',     label: 'My Fees' },
    // ... all detected routes
  ],
},
```

Generate a human-readable `label` from the path — e.g. `/fee-management` → `Fee Management`.

If you detect 0 routes (no Next.js project structure found), ask Hemant:

> "I couldn't find your Next.js pages directory. Please tell me the folder structure
> of your pages/routes, or paste a list of your app's URLs."

---

## PHASE 6 — AUTO-DETECT HTML SELECTORS

Your goal is to update the SELECTORS section in `config.ts` so Playwright can
correctly identify list items, pagination, filters, etc. in Hemant's actual HTML.

### Step 6a — Search for component files

```bash
# Find list/table components
find . -name "*.tsx" -not -path "*/node_modules/*" -not -path "*/rwa-audit/*" | xargs grep -l "map\|\.list\|DataTable\|Table\|ListView" 2>/dev/null | head -20

# Find pagination components
find . -name "*.tsx" -not -path "*/node_modules/*" -not -path "*/rwa-audit/*" | xargs grep -l "[Pp]agination\|[Pp]ager\|page_count\|totalPages" 2>/dev/null | head -10

# Find filter components
find . -name "*.tsx" -not -path "*/node_modules/*" -not -path "*/rwa-audit/*" | xargs grep -l "[Ff]ilter\|[Ss]earch[Bb]ar\|[Ff]ilterPanel" 2>/dev/null | head -10
```

### Step 6b — Detect UI library in use

Check `package.json` in the root project for these UI libraries:

```bash
cat package.json | grep -E "shadcn|radix|antd|ant-design|chakra|mantine|mui|material-ui|headlessui"
```

Based on what's found, use these known selectors:

**shadcn/ui or Radix:**

```typescript
listItem:   '[role="row"], [data-radix-collection-item], .table-row',
pagination: '[aria-label="pagination"], .pagination-root',
filterPanel: '[data-testid="filters"], .filter-bar',
```

**Ant Design:**

```typescript
listItem:   '.ant-table-row, .ant-list-item',
pagination: '.ant-pagination',
filterPanel: '.ant-form, .ant-select',
```

**Chakra UI:**

```typescript
listItem:   '[role="row"], .chakra-list__item',
pagination: '.chakra-pagination, [aria-label="pagination"]',
filterPanel: '.chakra-form-control',
```

**Mantine:**

```typescript
listItem:   '[role="row"], .mantine-Table-tr',
pagination: '.mantine-Pagination-root',
filterPanel: '.mantine-TextInput-root',
```

**Tailwind only (no UI lib):**

```typescript
listItem:   'tr, [class*="row"], [class*="list-item"], [class*="card"]',
pagination: '[class*="pagination"], [class*="pager"]',
filterPanel: '[class*="filter"], [class*="search-bar"]',
```

### Step 6c — Scan actual component files for class names

Pick the 2-3 most likely list component files found in Step 6a and read them.
Look for the className of the repeating item element (the one inside `.map()`).

Example: if you see:

```tsx
{residents.map(r => (
  <div className="resident-row border-b py-3" key={r.id}>
```

Then the selector is `.resident-row` or `[class*="resident-row"]`.

### Step 6d — Update SELECTORS in config.ts

Write the best selectors you found. Use comma-separated fallbacks for robustness:

```typescript
SELECTORS: {
  loginEmail:       'input[type="email"], input[name="email"], #email',
  loginPassword:    'input[type="password"], #password, input[name="password"]',
  loginSubmit:      'button[type="submit"], button:has-text("Login"), button:has-text("Sign in")',
  listItem:         '<detected selector>, tr, [class*="row"]',
  pagination:       '<detected selector>, [aria-label="pagination"]',
  filterPanel:      '<detected selector>, [class*="filter"]',
  tableHeaders:     'th, [class*="col-header"], [role="columnheader"]',
  loadingSpinner:   '[class*="spinner"], [class*="loading"], [role="progressbar"]',
  errorMessage:     '[class*="error"], [class*="alert"], [role="alert"]',
  emptyState:       '[class*="empty"], [class*="no-data"], [class*="no-results"]',
},
```

### Step 6e — Check login redirect

Find the login page component and look for where it redirects after successful login.
Update the login detection in `audit.ts` if needed — the current code waits for the
URL to no longer contain `/login`. If your app redirects to `/dashboard` specifically,
that will work fine without changes.

---

## PHASE 7 — RUN THE AUDIT

```bash
cd rwa-audit
npx ts-node src/audit.ts
```

**What to tell Hemant before running:**

> "Starting Phase 7 — the Playwright audit is about to run.
> A real Chrome window will open. You can watch Playwright navigate your app.
> Do not close the browser window — it will close itself when done.
> This will take approximately 5-10 minutes."

**Monitor for errors:**

If you see `ERR_CONNECTION_REFUSED`:

> "Playwright can't reach your app. Is RWA Connect running at {{BASE_URL}}?
> Please start it and tell me when it's ready."

If you see `Timeout waiting for navigation after login`:

> "Login may have failed. Check that the credentials in .env are correct,
> and that the login form selectors match your app."

If you see `Cannot find element matching selector`:

> "Some selectors need adjustment. I'll update config.ts and retry."
> Then re-run Phase 6 more carefully before re-running the audit.

When the audit completes successfully, you will see:

```
AUDIT COMPLETE ✅
Pages audited: X
Screenshots: ./screenshots/
Findings file: ./reports/findings.json
```

Proceed to Phase 8.

---

## PHASE 8 — RUN THE CLAUDE REVIEW

```bash
cd rwa-audit
npx ts-node src/claude-review.ts
```

This calls the Claude API and takes ~30-60 seconds.

**Tell Hemant:**

> "Sending audit data to Claude API for UX analysis..."

When complete you will see:

```
CLAUDE REVIEW COMPLETE ✅
CRITICAL      : X suggestions
HIGH          : X suggestions
MEDIUM        : X suggestions
NICE_TO_HAVE  : X suggestions
```

Open `reports/claude-report.md` and display the full contents to Hemant so he can
read the suggestions before the approval step.

Proceed to Phase 9.

---

## PHASE 9 — RUN THE APPROVAL CLI

```bash
cd rwa-audit
npx ts-node src/approve.ts
```

**Tell Hemant:**

> "The approval CLI is ready. You'll see each suggestion with its category and
> estimated effort. Use the keyboard to approve or skip:
>
> - **y** = approve this suggestion
> - **n** = skip it
> - **s** = skip all remaining suggestions in this category
> - **q** = done reviewing, generate output
>
> Or choose a quick mode:
>
> - **Mode 2** = auto-approve all CRITICAL items
> - **Mode 3** = auto-approve all CRITICAL + HIGH items
> - **Mode 4** = type specific IDs like `1,3,7,12`"

This step is interactive — Hemant drives it. You do not need to do anything
until it completes.

When the CLI exits, two files are created:

- `reports/approved-tasks.json`
- `reports/claude-code-prompt.md`

---

## PHASE 10 — FINAL HANDOFF

### Step 10a — Read the generated prompt

```bash
cat rwa-audit/reports/claude-code-prompt.md
```

### Step 10b — Display it to Hemant and explain the next step

Tell Hemant:

> "✅ The full audit pipeline is complete. Here's what was generated:
>
> **Audit results:**
>
> - Screenshots saved in `rwa-audit/screenshots/`
> - Full UX report: `rwa-audit/reports/claude-report.md`
> - Approved tasks: `rwa-audit/reports/approved-tasks.json`
>
> **To implement the approved fixes:**
> The file `rwa-audit/reports/claude-code-prompt.md` contains a ready-made
> prompt for me (Claude Code) to implement all your approved suggestions.
>
> Just paste the contents of that file into a new Claude Code message
> and I will start implementing the fixes one by one, asking for your
> confirmation before each change.
>
> Want me to read it and start now?"

### Step 10c — If Hemant says yes, start implementing

Read `rwa-audit/reports/claude-code-prompt.md` and begin working through
the approved tasks in priority order (CRITICAL first, then HIGH, then MEDIUM).

For each task:

1. Find the relevant component/file
2. Show Hemant the planned change (diff format or description)
3. Wait for a "yes/go ahead" confirmation
4. Make the change
5. Tell Hemant what to check in the browser to verify it worked

---

## IMPORTANT RULES FOR CLAUDE CODE

1. **Never delete or overwrite `.env`** if it already has values filled in
2. **Never commit credentials** — ensure `.env` is in `.gitignore`
3. **Never run `npm run run-all` directly** — run each step separately so
   Hemant can watch and intervene if needed
4. **If the audit finds 0 pages**, stop and debug before calling Claude API
   (no point sending empty data)
5. **If Claude API returns a non-JSON response**, save raw output to
   `reports/claude-raw.txt` and show it to Hemant for debugging
6. **Re-running is safe** — saved auth sessions in `auth-states/` are reused
   automatically so login doesn't need to happen again
7. **Screenshots accumulate** — they are not deleted between runs. Each run
   overwrites screenshots with the same name

---

## FILE STRUCTURE REFERENCE

```
rwa-audit/
├── RWA-Audit-System.md     ← this file (you are reading it)
├── .env.example             ← template (never edit this)
├── .env                     ← your secrets (never commit this)
├── package.json
├── tsconfig.json
├── src/
│   ├── config.ts            ← EDIT THIS (routes + selectors)
│   ├── types.ts             ← do not edit
│   ├── audit.ts             ← Playwright crawler (Step 1)
│   ├── claude-review.ts     ← Claude API reviewer (Step 2)
│   └── approve.ts           ← Approval CLI (Step 3)
├── screenshots/             ← auto-created by audit.ts
│   └── videos/              ← session recordings
├── auth-states/             ← auto-created, saved login sessions
└── reports/                 ← auto-created
    ├── findings.json        ← raw Playwright data
    ├── claude-report.json   ← Claude suggestions (structured)
    ├── claude-report.md     ← human-readable report
    ├── approved-tasks.json  ← Hemant's selections
    └── claude-code-prompt.md ← paste this back into Claude Code
```

---

## QUICK REFERENCE: COMMANDS

```bash
# Full pipeline (use this for first run)
cd rwa-audit && npm run run-all

# Individual steps
cd rwa-audit && npx ts-node src/audit.ts        # Step 1: Playwright crawl
cd rwa-audit && npx ts-node src/claude-review.ts # Step 2: Claude analysis
cd rwa-audit && npx ts-node src/approve.ts       # Step 3: Approval CLI

# Re-run audit only (faster, reuses login sessions)
cd rwa-audit && npx ts-node src/audit.ts

# View the report
cat rwa-audit/reports/claude-report.md

# View approved tasks
cat rwa-audit/reports/approved-tasks.json

# View the Claude Code implementation prompt
cat rwa-audit/reports/claude-code-prompt.md
```

---

_End of RWA-Audit-System.md_
_Drop this file in the rwa-audit folder. Open Claude Code. Say: "Read RWA-Audit-System.md and follow the instructions."_
