# Azure Deployment Plan — Docker + Container Apps, 3-Env Pipeline

## Context

The RWA Connect app (Next.js 16 / React 19 / Prisma 7 / Supabase) currently has a partial Azure deployment: one App Service called `rwaconnect360` deploying from `develop` branch via zip deploy. There is no Dockerfile, no staging environment, no proper observability, and no production environment.

Goal: set up a clean **Docker → Azure Container Apps** pipeline with three isolated environments (**dev**, **stage**, **prod**) mapped to `develop`, `staging`, `main` branches, using **GHCR (free)** for image hosting. Keep Supabase as DB and auth provider — **two Supabase projects**: `rwa-connect` (shared by dev + stage) and `rwa-connect-prod` (prod-only). Defer Key Vault; use Container Apps built-in env vars / secrets for now. Ship with good error logs via **Sentry** (app errors, already wired) + **Container Apps → Log Analytics** (free platform logs, no SDK).

### Why Container Apps over App Service

1. **Next.js 16 standalone + Docker** is the cleanest runtime — avoids Oryx build quirks already biting the existing `rwaconnect360`.
2. **Scale-to-zero on all three envs** → dev and stage cost ~$0 when idle; prod cost grows only with traffic.
3. **Same Dockerfile everywhere** → local, CI, Azure use identical runtime.
4. **No extra registry cost** — Container Apps pulls directly from GHCR with a PAT.

### Decisions locked in (all confirmed)

| Topic                    | Choice                                                                                                                                                                                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                  | Azure Container Apps (Consumption plan)                                                                                                                                                                                                                                                        |
| Region                   | Central India                                                                                                                                                                                                                                                                                  |
| Image registry           | GHCR (free, private)                                                                                                                                                                                                                                                                           |
| Branch → Env             | `develop` → dev, `staging` → stage, `main` → prod                                                                                                                                                                                                                                              |
| Promotion model          | **Push-based, no PRs for stage/prod.** Dev auto-deploys on push. Stage and prod are promoted via manual `workflow_dispatch` with approval gates.                                                                                                                                               |
| Image strategy           | **Build once, promote the artifact.** Dev build tags `dev-<sha>`; promotion retags as `stage-<sha>` → `prod-<sha>`. Same bytes all the way through.                                                                                                                                            |
| Approval gates           | Stage: `staging` env, 1 reviewer (self). Prod: `production` env, 1 reviewer (self). Extensible — add reviewers later via GitHub Settings → Environments.                                                                                                                                       |
| Scale                    | 0.5 vCPU / 1 GiB, min 0 / max 2–3 replicas, scale-to-zero in all envs                                                                                                                                                                                                                          |
| Secrets                  | Container Apps secrets + env vars (Key Vault deferred)                                                                                                                                                                                                                                         |
| DB                       | **Two Supabase projects**: `rwa-connect` (dev + stage, shared) / `rwa-connect-prod`                                                                                                                                                                                                            |
| App errors               | Sentry (already wired)                                                                                                                                                                                                                                                                         |
| Platform logs            | Container Apps → Log Analytics (free, no SDK)                                                                                                                                                                                                                                                  |
| App Insights SDK         | **Skipped** — resource provisioned only, reserved for future KQL use                                                                                                                                                                                                                           |
| RLS / raw SQL migrations | **Wrapped inside Prisma migrations** (single pipeline)                                                                                                                                                                                                                                         |
| CVE scanning             | Docker Scout in CI + Dependabot for base image                                                                                                                                                                                                                                                 |
| Custom domains           | `dev.rwaconnect360.com` / `stage.rwaconnect360.com` / `rwaconnect360.com` (apex) + `www.rwaconnect360.com`. Registrar: GoDaddy. Free Azure-managed certs. Procedure: [Phase 7](#phase-7--custom-domain-mapping-rwaconnect360com) and [runbooks/custom-domains.md](runbooks/custom-domains.md). |

---

## Cost Estimate (monthly, USD, Central India)

| Service                       | Dev       | Stage     | Prod       | Notes                                        |
| ----------------------------- | --------- | --------- | ---------- | -------------------------------------------- |
| Container Apps compute        | ~$0–1     | ~$0–1     | ~$3–8      | Scale-to-zero; billed per active vCPU-second |
| Container Apps Environment    | $0        | $0        | $0         | No base charge                               |
| Log Analytics Workspace       | shared    | shared    | shared     | 5 GB/mo free; $2.76/GB after                 |
| Application Insights resource | shared    | shared    | shared     | Provisioned, no SDK → no ingestion cost      |
| GHCR                          | $0        | $0        | $0         | Free private images                          |
| Egress bandwidth              | minimal   | minimal   | ~$0–2      | 100 GB/mo free                               |
| **Total realistic**           | **~$0–1** | **~$0–1** | **~$5–12** | **~$5–15/mo total**                          |

Cold start: ~3–8 s on prod's first request after idle. Accepted.

---

## Pipeline Visibility & Flow

### Three flows, not one

**A. Dev deploy** — automatic on every `develop` push. No gate.

```
git push origin develop
  │
  ▼
deploy-dev.yml runs
  ├─ lint / typecheck / test (fail fast)
  ├─ Docker Buildx (cached)
  ├─ docker scout cves
  ├─ build + push  ghcr.io/<owner>/rwa:dev-<sha> + :dev-latest + :sha-<sha>
  ├─ az login (OIDC)
  ├─ prisma migrate deploy  (DEV_DIRECT_URL → rwa-connect)
  ├─ db:seed:master
  ├─ az containerapp update --name rwa-dev --image ...:dev-<sha>
  └─ smoke-test /api/health → ✓ rwa-dev live
```

**B. Promote to stage** — manual button in GitHub Actions. 1 approval.

```
Actions → "Promote to stage" → Run workflow → click
  │
  ▼
promote-to-stage.yml runs
  ├─ ⏸ STAGING GATE  — reviewer clicks Approve
  ├─ docker pull ghcr.io/...:sha-<current-dev-sha>
  ├─ docker tag → push  :stage-<sha> + :stage-latest
  ├─ az login
  ├─ prisma migrate deploy  (STAGE_DIRECT_URL → rwa-connect, no-op if dev already ran it)
  ├─ az containerapp update --name rwa-stage --image ...:stage-<sha>
  └─ smoke-test → ✓ rwa-stage live
```

**C. Promote to prod** — manual button. 1 approval. Retags the stage image as prod.

```
Actions → "Promote to prod" → Run workflow → click
  │
  ▼
promote-to-prod.yml runs
  ├─ ⏸ PROD GATE  — reviewer clicks Approve
  ├─ docker pull ghcr.io/...:stage-<sha>
  ├─ docker tag → push  :prod-<sha> + :prod-latest
  ├─ az login
  ├─ prisma migrate deploy  (PROD_DIRECT_URL → rwa-connect-prod)
  ├─ db:seed:master  (on rwa-connect-prod)
  ├─ az containerapp update --name rwa-prod --image ...:prod-<sha>
  └─ smoke-test → ✓ rwa-prod live
```

**Key property:** the image bytes never change across envs. `dev-<sha>`, `stage-<sha>`, `prod-<sha>` are three tags on the same SHA-256 digest. What you tested in stage is exactly what runs in prod.

### Master-data-only workflow (no code deploy)

When master tables change outside a code deploy (new billing plan, new platform config), use this workflow. Does NOT rebuild or redeploy the app.

```
Actions → "Seed master data" → Run workflow → pick env (dev/stage/prod) → Run
  │
  ▼
seed-master.yml runs
  ├─ ⏸ Gate only if env=prod (production environment reviewer)
  ├─ checkout main
  ├─ npm ci
  ├─ DATABASE_URL=<env>_DIRECT_URL npm run db:seed:master
  └─ ✓ master tables re-asserted
```

### Where to see what

| What you want to know        | Where                                    | How                                                      |
| ---------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| Deploy running now?          | GitHub → Actions                         | Yellow dot next to commit                                |
| Build/push log (live)        | GH Actions run page                      | Click running job                                        |
| Build failed?                | Same place                               | Red X + stack trace                                      |
| Current deployed image       | Azure Portal → Container App → Revisions | Active revision shows SHA                                |
| Revision history             | Azure Portal / CLI                       | `az containerapp revision list --name rwa-<env>`         |
| Live container logs          | Portal → Log stream                      | or `az containerapp logs show --name rwa-<env> --follow` |
| HTTP errors / slow requests  | Log Analytics                            | KQL on `ContainerAppConsoleLogs_CL`                      |
| Application errors (grouped) | Sentry                                   | Already wired                                            |
| Image tags                   | GitHub repo → Packages                   | Every tag + timestamp                                    |
| Prod deploy approver         | GH Actions run → Environments            | Reviewer + timestamp                                     |

### Rollback (two paths, both fast)

1. **Re-point image** (~30 s): `az containerapp update --name rwa-prod --image ghcr.io/<owner>/rwa:prod-<previous-sha>`
2. **Activate prior revision** (~10 s): `az containerapp revision activate` + `az containerapp ingress traffic set`

---

## Implementation — 7 Phases

### Phase 1 — App containerization (code changes)

Files to create / modify:

1. **`next.config.ts`** — add `output: "standalone"` to the config object (Vercel-safe: Vercel ignores this flag).

2. **`Dockerfile`** (new) — multi-stage:
   - Stage `deps`: `node:22-alpine`, `npm ci --ignore-scripts`
   - Stage `builder`: copy deps + source, `npx prisma generate --schema supabase/schema.prisma`, `npm run build`. Build args: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.
   - Stage `runner`: `node:22-alpine`, non-root user `nextjs:nodejs` (uid 1001), copy `.next/standalone`, `.next/static`, `public/`, Prisma client. `EXPOSE 3000`, `CMD ["node", "server.js"]`.

3. **`.dockerignore`** (new) — exclude `node_modules`, `.next`, `.git`, `tests/`, `coverage/`, `playwright-report/`, `.env*` except `.env.example`, `execution_plan/`, `external_docs/`, `docs/`, `.vscode/`, `cov-existing/`.

4. **`src/app/api/health/route.ts`** (new) — `GET` returning `{ status: "ok", ts: Date.now() }`.

5. **Prisma verify** — `@prisma/adapter-pg` is in `package.json`. Verify [../src/lib/prisma.ts](../src/lib/prisma.ts) uses the adapter (Alpine-safe) — fix if not.

6. **`deployment/scripts/azure-setup.sh`** (new) — inert ordered `az` CLI commands for Phase 2 infrastructure. Not auto-run.

7. **`deployment/` runbooks** — [rollback.md](runbooks/rollback.md), [observability.md](runbooks/observability.md), [troubleshooting.md](runbooks/troubleshooting.md), [db-migrations.md](runbooks/db-migrations.md).

8. **`.github/dependabot.yml`** (new) — Docker ecosystem, watches Dockerfile base image, opens PRs when `node:22-alpine` has a patched version. Weekly interval.

### Phase 2 — Azure infrastructure (manual via `deployment/scripts/azure-setup.sh`)

Subscription: same one holding `rwaconnect360`. Region: `centralindia`.

1. **Resource group** — `rwa-rg-centralindia` (reuse if exists).
2. **Log Analytics Workspace** — `rwa-logs` (shared).
3. **Application Insights** — `rwa-appinsights` (resource only, workspace-based, no SDK).
4. **Container Apps Environment** — `rwa-env` (shared across all 3 apps).
5. **Three Container Apps** — `rwa-dev`, `rwa-stage`, `rwa-prod`:
   - Ingress external, port 3000, HTTPS-only
   - CPU 0.5, memory 1 Gi, min 0 replicas, max 2 (dev/stage) / 3 (prod)
   - GHCR registry credentials (PAT as secret)
   - Env vars per Phase 3
   - Liveness probe on `/api/health`

### Phase 3 — Env vars + secrets per environment

Two Supabase projects. `rwa-dev` + `rwa-stage` Container Apps both point at `rwa-connect`; `rwa-prod` points at `rwa-connect-prod`.

**Container App secrets** (encrypted): `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS`, `WATI_API_KEY`, `SENTRY_AUTH_TOKEN`, `GHCR_TOKEN`.

**Container App plain env vars**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`, `TRIAL_PERIOD_DAYS`, `MAX_TRIAL_RESIDENTS`, `WATI_API_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `NODE_ENV=production`.

### Phase 3B — Database migration & data movement strategy

**Schema changes (DDL + RLS/triggers/functions)** — single pipeline:

- All schema + policy changes live inside **Prisma migrations** (wrap raw SQL for RLS/functions into `migration.sql` files).
- CI step: `npx prisma migrate deploy --schema supabase/schema.prisma` against `<ENV>_DIRECT_URL` (port 5432; pooler port 6543 times out on DDL — see CLAUDE.md).
- Dev and stage share `rwa-connect`, so they share a single `_prisma_migrations` table. Stage's `migrate deploy` is a no-op for anything dev already applied. Prod has its own independent migration state on `rwa-connect-prod`.
- Migration order: `deploy-dev.yml` runs first (auto on push to `develop` — affects stage immediately since shared DB) → `promote-to-prod.yml` runs migrations on prod after the gate approval.
- **Never use `db push` or `migrate dev` in CI** — only `migrate deploy`.

**Master / reference data**:

- CI runs `npm run db:seed:master` after `migrate deploy` in every env. [../supabase/seed-master.ts](../supabase/seed-master.ts) is already idempotent (upsert).
- Keeps platform plans, billing options, SuperAdmin consistent across envs.

**Dev demo data**:

- `npm run db:seed:dev` runs **only manually, only on dev**. Hard-guard in the script: check `NODE_ENV !== "production"` and require an explicit `SEED_ALLOW=1` env var. Never runs from CI.

**Prod → stage data refresh** (for realistic stage testing):

- [scripts/db-sync-prod-to-stage.sh](scripts/db-sync-prod-to-stage.sh) (Phase 6 deliverable):
  1. Interactive confirmation ("type YES to overwrite stage")
  2. `pg_dump` from prod with `--exclude-table-data` on sensitive tables (sessions, audit logs, any PII tables)
  3. PII scrub: emails → `user-N@example.com`, phone numbers → synthetic
  4. `pg_restore` to stage via direct connection
  5. Re-run `db:seed:master` to re-assert master data
- Never runs prod → dev (use sanitized fixtures) and never dev → anywhere upstream.

**Rollback / recovery policy**:

- Prisma does **not** auto-rollback schema changes.
- Supabase takes daily backups (7-day point-in-time recovery on paid tier) — this is our rollback mechanism for catastrophic migrations.
- For reversible changes: use **expand-contract** pattern (add new → migrate data → switch app → remove old).
- Pre-migration checklist lives in [runbooks/db-migrations.md](runbooks/db-migrations.md).

### Phase 4 — GHCR setup

1. Fine-grained PAT: one `write:packages` (for CI), one `read:packages` (for Azure pull — stored as `GHCR_TOKEN` in each Container App).
2. Image naming: `ghcr.io/<owner>/rwa:<env>-<sha>` + `:<env>-latest`.
3. GHCR free tier: 500 MB storage. Expected image size: 150–250 MB. Add cleanup workflow if it grows.

### Phase 5 — GitHub Actions workflows (replace existing)

**Delete** `azure-deploy.yml`, `develop_rwaconnect360.yml`, `error-fix-stable-build_rwaconnect360.yml`.

**Create four workflows:**

1. `.github/workflows/deploy-dev.yml` — trigger: push to `develop`. No gate. Builds, migrates `rwa-connect`, deploys `rwa-dev`.
2. `.github/workflows/promote-to-stage.yml` — trigger: `workflow_dispatch` only. Gate: `environment: staging` (1 reviewer = self). Retags dev image as stage, deploys `rwa-stage`.
3. `.github/workflows/promote-to-prod.yml` — trigger: `workflow_dispatch` only. Gate: `environment: production` (1 reviewer = self). Retags stage image as prod, migrates `rwa-connect-prod`, deploys `rwa-prod`.
4. `.github/workflows/seed-master.yml` — trigger: `workflow_dispatch` with `environment` input (dev/stage/prod). Runs `db:seed:master` against selected env. Prod choice gates on `production` env reviewer. No image rebuild, no redeploy.

**Why no `deploy-stage.yml` / `deploy-prod.yml` on push triggers:** branch protection on `staging` and `main` disallows direct human push. Only the promotion workflows (authenticated via `GITHUB_TOKEN`) can update those branches, and they deploy as part of the same run. Push-triggered deploy workflows would be redundant.

**Steps per workflow:**

_deploy-dev.yml (10 steps):_

1. Checkout
2. Setup Node 22, install deps with cache
3. Lint + typecheck + test (fail fast before Docker)
4. Docker Buildx with GHA cache (`cache-from: type=gha`)
5. Docker Scout CVE scan (fail on HIGH+; dev may warn-only during Phase 6 shakedown)
6. Log in to GHCR (`packages: write`)
7. Build + push image with `NEXT_PUBLIC_*` build args; tag with `dev-<sha>`, `dev-latest`, and `sha-<sha>`
8. Log in to Azure (OIDC federated)
9. `npx prisma migrate deploy` (DEV_DIRECT_URL) + `npm run db:seed:master`
10. `az containerapp update` + smoke-test `/api/health` with 5 retries

_promote-to-stage.yml (7 steps):_

1. `environment: staging` → pause for approval
2. Checkout `develop`, capture HEAD SHA
3. Log in to GHCR, `docker pull ghcr.io/.../rwa:sha-<sha>`
4. `docker tag` + push as `stage-<sha>` + `stage-latest`
5. Log in to Azure
6. `npx prisma migrate deploy` (STAGE_DIRECT_URL — no-op if dev already applied) + `npm run db:seed:master`
7. `az containerapp update --name rwa-stage` + smoke-test

_promote-to-prod.yml (8 steps):_

1. `environment: production` → pause for approval
2. Checkout `staging`, capture HEAD SHA
3. Log in to GHCR, `docker pull` the `stage-<sha>` image
4. `docker tag` + push as `prod-<sha>` + `prod-latest`
5. Log in to Azure
6. `npx prisma migrate deploy` (PROD_DIRECT_URL → `rwa-connect-prod`)
7. `npm run db:seed:master` (against prod)
8. `az containerapp update --name rwa-prod` + smoke-test + `git push origin staging:main` via `GITHUB_TOKEN` (keeps `main` branch in sync with what's deployed, for audit)

_seed-master.yml (5 steps):_

1. `environment: ${{ inputs.environment }}` → pause for approval only if prod
2. Checkout `main`
3. `npm ci`
4. `DATABASE_URL=<env>_DIRECT_URL npm run db:seed:master`
5. Summary: print upsert counts

### Phase 5a — Branch protection (enforces the promotion model)

Configure in GitHub → Settings → Branches → add rules:

| Branch    | Direct push                           | Required reviews | Required status checks   | Force push |
| --------- | ------------------------------------- | ---------------- | ------------------------ | ---------- |
| `develop` | Allowed (your working branch)         | Optional         | CI green                 | Disabled   |
| `staging` | **Blocked for humans**, workflow-only | N/A              | `promote-to-stage` green | Disabled   |
| `main`    | **Blocked for humans**, workflow-only | N/A              | `promote-to-prod` green  | Disabled   |

Staging and main become "owned" by the promotion workflows. A human cannot bypass the gate by pushing directly.

### Phase 5b — GitHub Environments (where the gates live)

GitHub → Settings → Environments → create two:

| Environment  | Required reviewers       | Deployment branches | Secrets scoped here                                                                                |
| ------------ | ------------------------ | ------------------- | -------------------------------------------------------------------------------------------------- |
| `staging`    | `hemant1234bhagat` (you) | `develop` only      | `STAGE_DATABASE_URL`, `STAGE_DIRECT_URL`, `STAGE_NEXT_PUBLIC_*`, `STAGE_SUPABASE_SERVICE_ROLE_KEY` |
| `production` | `hemant1234bhagat` (you) | `staging` only      | `PROD_DATABASE_URL`, `PROD_DIRECT_URL`, `PROD_NEXT_PUBLIC_*`, `PROD_SUPABASE_SERVICE_ROLE_KEY`     |

"Deployment branches" restricts which branches can invoke the environment — prevents someone running `promote-to-prod` from a random feature branch.

**GitHub secrets needed (split by scope):**

_Repo-level secrets (shared):_ `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `GHCR_READ_TOKEN`.

_Dev env vars (repo-level, not env-scoped since dev has no gate):_ `DEV_DATABASE_URL`, `DEV_DIRECT_URL`, `DEV_NEXT_PUBLIC_SUPABASE_URL`, `DEV_NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DEV_NEXT_PUBLIC_APP_URL`, `DEV_SUPABASE_SERVICE_ROLE_KEY`.

_Staging env-scoped secrets:_ `STAGE_DATABASE_URL`, `STAGE_DIRECT_URL`, `STAGE_NEXT_PUBLIC_SUPABASE_URL`, `STAGE_NEXT_PUBLIC_SUPABASE_ANON_KEY`, `STAGE_NEXT_PUBLIC_APP_URL`, `STAGE_SUPABASE_SERVICE_ROLE_KEY`.

_Production env-scoped secrets:_ `PROD_DATABASE_URL`, `PROD_DIRECT_URL`, `PROD_NEXT_PUBLIC_SUPABASE_URL`, `PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PROD_NEXT_PUBLIC_APP_URL`, `PROD_SUPABASE_SERVICE_ROLE_KEY`.

Note: `STAGE_*` secrets can technically reuse `DEV_*` values since both point at `rwa-connect` — but keep them as separate secrets so the shared-DB decision can be reversed later without a secret rename.

### Phase 7 — Custom domain mapping (`rwaconnect360.com`)

Bind the GoDaddy-registered domain to all three Container Apps. Default `*.azurecontainerapps.io` URLs stay bound as fallback.

| Env   | Container App | Custom hostname            | Validation | DNS record at GoDaddy             |
| ----- | ------------- | -------------------------- | ---------- | --------------------------------- |
| dev   | `rwa-dev`     | `dev.rwaconnect360.com`    | CNAME      | CNAME `dev` + TXT `asuid.dev`     |
| stage | `rwa-stage`   | `stage.rwaconnect360.com`  | CNAME      | CNAME `stage` + TXT `asuid.stage` |
| prod  | `rwa-prod`    | `rwaconnect360.com` (apex) | TXT        | A `@` + TXT `asuid`               |
| prod  | `rwa-prod`    | `www.rwaconnect360.com`    | CNAME      | CNAME `www`                       |

**Per-env steps (full commands in [runbooks/custom-domains.md](runbooks/custom-domains.md)):**

1. Read the env's `customDomainVerificationId` and `staticIp` (Container Apps Environment, shared across all 3 apps).
2. Add the GoDaddy DNS records (CNAME / A + matching `asuid` TXT). Wait 5–15 min for propagation.
3. `az containerapp hostname add` + `az containerapp hostname bind` per app/hostname. Bind step provisions a free Azure-managed cert (~3–5 min).
4. Update GitHub secret `NEXT_PUBLIC_APP_URL` (and `STAGE_*`, `PROD_*` variants) — this is **build-time** baked into the client bundle.
5. Update Container App runtime env vars (`NEXT_PUBLIC_APP_URL`, `APP_URL`) via `az containerapp update --set-env-vars`.
6. Re-trigger a deploy on each env so the rebuilt client bundle has the new URL hard-coded.
7. Update Supabase Auth URL Configuration on **both** Supabase projects (`rwa-connect`, `rwa-connect-prod`) — Site URL + Redirect URLs allow-list.
8. Verify: `curl https://<domain>/api/health` returns 200; TLS cert issuer is Microsoft / DigiCert; sign-in flow works end-to-end.

**Critical gotcha:** `NEXT_PUBLIC_APP_URL` is baked into the build via the [Dockerfile](../Dockerfile) `ARG`. Updating the Container App env var alone is insufficient — the client `_next/static/*.js` still contains the old URL until the image is rebuilt. Always run Step 6.

**Apex stability:** the env's static IP only changes if the Container Apps Environment is recreated. Apex A record is stable as long as `rwa-env` is not deleted. For true apex resilience, put Azure Front Door in front of `rwa-prod` (~$35/mo) — not justified at current scale.

### Phase 6 — Cutover + verification

1. Push to `develop` — verify `deploy-dev.yml` runs end-to-end, `rwa-dev` is live, `/api/health` green.
2. Stream logs: `az containerapp logs show --name rwa-dev --follow` — confirm stdout/stderr flows to Log Analytics.
3. Trigger a test error; confirm it lands in Sentry within ~1 min.
4. Flesh out [scripts/db-sync-prod-to-stage.sh](scripts/db-sync-prod-to-stage.sh) (Phase 3B deliverable); test the dry-run flag only.
5. Create `staging` branch from `develop` once (`git checkout -b staging && git push -u origin staging`). After that, the branch is workflow-managed only.
6. Click **Promote to stage** → approve → verify stage deploys and points at `rwa-connect`.
7. Click **Promote to prod** → approve → verify prod approval gate, deploy, `rwa-connect-prod` migration, health check.
8. Test **Seed master data** workflow against dev (no gate), then against prod (gate triggers).
9. Verify branch protection is enforcing: try `git push origin staging` from local — must be rejected.
10. **Decommission `rwaconnect360`** only after prod is stable for ~7 days.

---

## Critical files to touch

| Path                                                                 | Action           | Purpose                                       |
| -------------------------------------------------------------------- | ---------------- | --------------------------------------------- |
| [../next.config.ts](../next.config.ts)                               | modify           | add `output: "standalone"`                    |
| `../Dockerfile`                                                      | create           | multi-stage build                             |
| `../.dockerignore`                                                   | create           | exclude cruft                                 |
| [scripts/azure-setup.sh](scripts/azure-setup.sh)                     | create           | inert Phase 2 `az` CLI commands               |
| [scripts/db-sync-prod-to-stage.sh](scripts/db-sync-prod-to-stage.sh) | create (Phase 6) | sanitized prod→stage refresh                  |
| [README.md](README.md)                                               | create           | ops architecture overview                     |
| [runbooks/rollback.md](runbooks/rollback.md)                         | create           | two rollback paths with commands              |
| [runbooks/observability.md](runbooks/observability.md)               | create           | "where to look when X" table                  |
| [runbooks/troubleshooting.md](runbooks/troubleshooting.md)           | create           | common failure modes                          |
| [runbooks/db-migrations.md](runbooks/db-migrations.md)               | create           | pre-migration checklist, backup/restore steps |
| [../src/app/api/health/route.ts](../src/app/api/health/route.ts)     | create           | liveness probe                                |
| [../src/lib/prisma.ts](../src/lib/prisma.ts)                         | verify           | `@prisma/adapter-pg` in use                   |
| `../.github/dependabot.yml`                                          | create           | Dockerfile base-image PRs                     |
| `../.github/workflows/deploy-dev.yml`                                | create (Phase 5) | push-to-develop auto-deploy                   |
| `../.github/workflows/promote-to-stage.yml`                          | create (Phase 5) | workflow_dispatch + staging gate              |
| `../.github/workflows/promote-to-prod.yml`                           | create (Phase 5) | workflow_dispatch + production gate           |
| `../.github/workflows/seed-master.yml`                               | create (Phase 5) | workflow_dispatch to seed master data per env |
| `../.github/workflows/azure-deploy.yml`                              | delete (Phase 5) | old App Service workflow                      |
| `../.github/workflows/develop_rwaconnect360.yml`                     | delete (Phase 5) | old App Service workflow                      |
| `../.github/workflows/error-fix-stable-build_rwaconnect360.yml`      | delete (Phase 5) | old App Service workflow                      |

No changes to application code, DB schema, or tests.

---

## Verification — end-to-end test plan

1. **Local Docker**: `docker build -t rwa-local .` then `docker run -p 3000:3000 --env-file .env.local rwa-local`. `/api/health` and `/` both succeed.
2. **Vercel compatibility check**: ensure the Vercel-connected branch (if any) still builds — `output: "standalone"` is a no-op on Vercel.
3. **Dev deploy**: throwaway commit to `develop`. Confirm GHCR push, Container App update, `/api/health` green.
4. **Stage deploy**: cut `staging` from `develop`, push. Verify stage points at stage Supabase.
5. **Prod deploy**: merge to `main`. Confirm approval gate, then verify prod live.
6. **Migration test**: create a trivial Prisma migration locally → push to `develop` → confirm it lands in dev Supabase, not in stage/prod until promoted.
7. **Seed test**: confirm `db:seed:master` runs in CI on each env; confirm `db:seed:dev` is NOT triggered automatically.
8. **Platform logs**: trigger error, confirm appears in `az containerapp logs show` within 30 s.
9. **App errors**: same trigger, confirm Sentry receives within 1 min.
10. **Cold start**: leave dev idle 10 min, measure first-request latency (~3–8 s expected).
11. **Rollback drill**: on prod, run rollback command. Traffic shifts within ~30 s.
12. **CVE scan**: intentionally add a known-vulnerable package, confirm Docker Scout fails the build.

---

## Skills roadmap (post-Phase 6)

Three Claude Code skills would turn the runbooks from passive docs into interactive guides. Defer until after the first few real prod deploys — build them once you've felt the repetition and know which checks actually matter vs which are theoretical.

| Skill              | Purpose                                                                                                                                                                                                           | Runbook it wraps                                                                 | Trigger / frequency                                                                     | Priority |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| `/deploy-check`    | Pre-promotion audit. Reports a go/no-go: is dev green? Supabase backup < 24h old? GHCR PAT not expiring in < 30 days? Any open HIGH CVEs on the current image? Any destructive migration in the dev → stage diff? | [db-migrations.md](runbooks/db-migrations.md) checklist + pipeline status checks | Before every "Promote to prod" click                                                    | High     |
| `/deploy-rollback` | Guided incident recovery. Asks env → lists recent revisions with image SHAs and timestamps → executes the chosen rollback path with per-step confirmation. Captures post-incident notes for the incidents log.    | [rollback.md](runbooks/rollback.md)                                              | During an incident (rare, but high-stakes)                                              | High     |
| `/db-migrate`      | Before opening any schema PR: runs the pre-migration checklist, detects destructive DDL in the migration SQL, prompts expand-contract split if needed, verifies direct connection string usage (not pooler).      | [db-migrations.md](runbooks/db-migrations.md)                                    | Before opening any PR that touches `supabase/schema.prisma` or `supabase/migrations/**` | Medium   |

### When to build each

- **After first week on prod**: `/deploy-rollback`. The moment you need it, you want it ready — practice during a calm week, not under fire.
- **After first destructive migration attempt**: `/db-migrate`. The first time you almost ship a `DROP COLUMN` without expand-contract is the signal.
- **After third "oh wait, I forgot to check X before promoting"**: `/deploy-check`. If it never happens, you don't need it.

### Skill file structure (for reference, not implementation here)

```
.claude/skills/deploy-check/SKILL.md
.claude/skills/deploy-rollback/SKILL.md
.claude/skills/db-migrate/SKILL.md
```

Each follows the existing repo pattern (YAML frontmatter + instructions; reads the runbook at execution time so the skill stays in sync with doc changes).

### What NOT to make into a skill

- The actual deploy. That's a GitHub Actions workflow — push a button, done. Wrapping it in a skill adds no value.
- The infrastructure setup. One-time manual work via [scripts/azure-setup.sh](scripts/azure-setup.sh). A skill here would be pure overhead.
- Troubleshooting. Ctrl-F on [troubleshooting.md](runbooks/troubleshooting.md) is faster than a dialogue.

---

## Decisions confirmed (no open questions)

- Supabase: two projects — `rwa-connect` (dev + stage, shared DB) and `rwa-connect-prod`
- Observability: Sentry + Log Analytics, no App Insights SDK
- RLS / raw SQL: wrapped inside Prisma migrations (single pipeline)
- DB Phase 3B: included in plan
- CVE scanning: Docker Scout + Dependabot, both added
- Custom domains: `dev.rwaconnect360.com`, `stage.rwaconnect360.com`, `rwaconnect360.com` (apex), `www.rwaconnect360.com`. GoDaddy DNS, free Azure-managed certs. Procedure in [runbooks/custom-domains.md](runbooks/custom-domains.md). Default `*.azurecontainerapps.io` URLs remain bound as fallback.
- Execution shape: Phase 1 deliverables (code + setup script + runbooks + Dependabot) in one pass, then Phases 2–6 manual on your signal
- Promotion: push-based (no PRs). Dev auto-deploys; stage and prod promoted via workflow_dispatch with approval gates.
- Gates: `staging` and `production` environments, required reviewer = self (extensible).
- Image flow: build once in dev, retag through stage and prod. Same bytes everywhere.
- Branch protection: `staging` and `main` writable only by promotion workflows; humans push to `develop` only.
- Master data: standalone `seed-master.yml` workflow with per-env selector; prod choice is gate-protected.
