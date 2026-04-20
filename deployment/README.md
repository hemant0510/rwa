# Deployment — RWA Connect

Central hub for all Azure deployment artifacts: the master plan, runbooks for day-2 ops, and the infrastructure setup scripts.

## Architecture at a glance

```
push to develop ──► deploy-dev.yml  (auto, no gate)
                       └─ build once → GHCR :dev-<sha> → deploy rwa-dev

click "Promote to stage" ──► promote-to-stage.yml
                       ⏸ staging gate (approve)
                       └─ retag GHCR :stage-<sha> → deploy rwa-stage

click "Promote to prod" ──► promote-to-prod.yml
                       ⏸ production gate (approve)
                       └─ retag GHCR :prod-<sha> → migrate rwa-connect-prod → deploy rwa-prod

click "Seed master data" ──► seed-master.yml  (any env)
                       └─ db:seed:master against chosen DIRECT_URL
                       └─ prod choice hits the production gate
```

Pipeline details: build once in dev, promote the **same image bytes** through stage → prod (retag, don't rebuild). Azure deploy uses OIDC federated login. Logs flow to Log Analytics; app errors flow to Sentry.

Three Container Apps behind one Container Apps Environment, one per env:

| Env   | Branch    | App name    | Supabase project                |
| ----- | --------- | ----------- | ------------------------------- |
| dev   | `develop` | `rwa-dev`   | `rwa-connect`                   |
| stage | `staging` | `rwa-stage` | `rwa-connect` (shared with dev) |
| prod  | `main`    | `rwa-prod`  | `rwa-connect-prod`              |

**Note:** dev and stage point at the same Supabase project (`rwa-connect`) — shared DB, shared `_prisma_migrations`. Prod is fully isolated. See [runbooks/db-migrations.md](runbooks/db-migrations.md) for migration flow implications.

All apps: Consumption plan, `centralindia`, 0.5 vCPU / 1 GiB, min 0 / max 2–3 replicas, scale-to-zero.

## Files in this folder

| Path                                                                 | Purpose                                                                 |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [plan.md](plan.md)                                                   | Full 7-phase plan — read this first                                     |
| [runbooks/rollback.md](runbooks/rollback.md)                         | Two rollback paths with exact commands                                  |
| [runbooks/observability.md](runbooks/observability.md)               | Where to look when something's wrong                                    |
| [runbooks/troubleshooting.md](runbooks/troubleshooting.md)           | Common failure modes + fixes                                            |
| [runbooks/db-migrations.md](runbooks/db-migrations.md)               | Pre-migration checklist, expand-contract, rollback via Supabase backups |
| [scripts/azure-setup.sh](scripts/azure-setup.sh)                     | Inert ordered `az` CLI commands for Phase 2                             |
| [scripts/db-sync-prod-to-stage.sh](scripts/db-sync-prod-to-stage.sh) | Sanitised prod → stage refresh (stub — Phase 6)                         |

## Where the runtime artifacts live (outside this folder)

Files that must live in specific locations (tool conventions) are referenced from here but not copied:

| Path                                                             | Purpose                                                   |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| [../Dockerfile](../Dockerfile)                                   | Multi-stage build (not yet created — Phase 1 deliverable) |
| [../.dockerignore](../.dockerignore)                             | Build context exclusions (Phase 1)                        |
| [../next.config.ts](../next.config.ts)                           | Add `output: "standalone"` (Phase 1)                      |
| [../src/app/api/health/route.ts](../src/app/api/health/route.ts) | Liveness probe (Phase 1)                                  |
| [../.github/workflows/deploy-dev.yml](../.github/workflows/)     | Push-to-develop deploy (Phase 5)                          |
| [../.github/workflows/deploy-stage.yml](../.github/workflows/)   | Push-to-staging deploy (Phase 5)                          |
| [../.github/workflows/deploy-prod.yml](../.github/workflows/)    | Push-to-main deploy + approval gate (Phase 5)             |
| [../.github/dependabot.yml](../.github/)                         | Dockerfile base-image PRs (Phase 1)                       |

## Quick operational links

- Deploy status: GitHub → Actions tab
- Container logs (live): `az containerapp logs show --name rwa-<env> --follow`
- KQL queries: Azure Portal → Log Analytics Workspace `rwa-logs`
- App errors (grouped): Sentry project dashboard
- Image history: GitHub repo → Packages tab

## Cost target

~$5–15 / month all-in across all three environments. See [plan.md](plan.md) cost table.
