# Troubleshooting — Azure Container Apps deploy

Common failures seen during build, push, deploy, and runtime. Add new entries as they come up.

---

## Build-time failures (GitHub Actions)

### `Error: @prisma/client did not initialize yet`

**Cause**: Dockerfile skipped `prisma generate` before `next build`, or `schema.prisma` path is wrong.
**Fix**: In the `builder` stage, run `npx prisma generate --schema supabase/schema.prisma` before `npm run build`. Remember: the schema folder was renamed from `prisma/` to `supabase/` — CLAUDE.md.

### `Could not find a production build in the .next directory`

**Cause**: Missing `output: "standalone"` in [../../next.config.ts](../../next.config.ts), so `.next/standalone` doesn't exist for the runner stage to copy.
**Fix**: Add `output: "standalone"` to the `nextConfig` object. It's a no-op on Vercel.

### `sh: lightningcss: not found` / `Error: Cannot find module '../lightningcss.linux-x64-gnu.node'`

**Cause**: Tailwind v4 uses `lightningcss`, which has platform-specific native binaries. Alpine (musl) vs glibc mismatch.
**Fix**: Either (a) use `node:22-bookworm-slim` instead of `node:22-alpine` in the runner stage, or (b) install `libc6-compat` on Alpine: `RUN apk add --no-cache libc6-compat`. Prefer the bookworm approach if image size isn't critical — fewer surprises long-term.

### `docker scout cves` fails on a HIGH CVE we can't fix yet

**Cause**: Base image or a transitive dep has a new CVE.
**Fix**:

1. Check if Dependabot has a PR open for a patched base image → merge it.
2. If the CVE is in a direct dep, update the package and re-run.
3. If the CVE is unfixable short-term and genuinely low risk, use `docker scout cves --only-severity high,critical --ignore-fixed-in <pkg>@<ver>` with a comment pointing to a tracking issue. Do not blanket-ignore.

### GHCR push rejected: `unauthorized`

**Cause**: `GITHUB_TOKEN` missing `packages: write` permission in the workflow's `permissions:` block, or the PAT used for CI has expired.
**Fix**:

```yaml
permissions:
  contents: read
  packages: write
  id-token: write
```

### Build succeeds but `NEXT_PUBLIC_*` values are undefined at runtime

**Cause**: `NEXT_PUBLIC_*` vars are baked in at build time, not read from env at runtime. Passing them only as Container App env vars does nothing if they weren't also passed as Docker build args.
**Fix**: Pass them as `--build-arg` in the GH Actions docker build step AND declare them as `ARG` in the Dockerfile `builder` stage before `npm run build`. Yes, they have to appear in both places.

---

## Deploy-time failures (Azure CLI)

### `ERROR: The request was forbidden by policy` on `az containerapp update`

**Cause**: OIDC federated identity missing the right role on the Container App.
**Fix**: Confirm the app registration has at least `Container Apps Contributor` on the resource group.

### `ERROR: Failed to pull image from registry`

**Cause**: Container App's `GHCR_TOKEN` secret is stale, or PAT expired (GH fine-grained PATs max out at 1 year).
**Fix**:

```bash
az containerapp registry set \
  --name rwa-<env> \
  --resource-group rwa-rg-centralindia \
  --server ghcr.io \
  --username <github-user> \
  --password <new-read-packages-PAT>
```

### `prisma migrate deploy` hangs or errors with `connection timeout`

**Cause**: CI is pointing at the pooler port (6543). DDL statements time out through pgbouncer.
**Fix**: Use `<ENV>_DIRECT_URL` (port 5432) for migrations. See CLAUDE.md — this is the #1 cause of silent migration failures.

### `P3009: migrate found failed migrations in the target database`

**Cause**: A previous migration failed mid-way, leaving `_prisma_migrations` in a broken state.
**Fix**: Manual recovery — do NOT `migrate reset` on any non-dev env.

1. Connect via `psql` with `DIRECT_URL`.
2. Inspect `SELECT * FROM _prisma_migrations WHERE finished_at IS NULL;`.
3. Roll forward or roll back the half-applied SQL by hand.
4. `UPDATE _prisma_migrations SET rolled_back_at = now() WHERE id = '<id>';` if unrecoverable.
5. Re-run `migrate deploy`.

---

## Runtime failures

### `/api/health` returns 200 locally but 502 on Azure

**Cause**: Container Apps liveness probe expects the app to listen on the ingress target port. Next.js standalone listens on `$PORT` (default 3000). If `targetPort` in the Container App config is anything else → 502.
**Fix**: Confirm ingress target port is 3000.

```bash
az containerapp ingress show --name rwa-<env> --resource-group rwa-rg-centralindia
```

### Cold start takes > 15 s

**Cause**: Scale-to-zero + Prisma client + Next.js boot. Normal range is 3–8 s.
**Fix**: If > 15 s consistently, consider setting `min-replicas 1` on prod only (costs ~$10/mo extra) OR investigate with `az containerapp revision show` — large images and many env vars slow cold start.

### App loads but Supabase calls fail with `Invalid API key`

**Cause**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` was baked into the image at build time against the wrong Supabase project.
**Fix**: Rebuild with the correct build arg. Anon key is public — safe to put in the image for that env — but it must match the project in `NEXT_PUBLIC_SUPABASE_URL`.

### Sentry source maps not resolving (stacktraces show minified code)

**Cause**: `SENTRY_AUTH_TOKEN` missing at build time, or `sourcemaps.disable: true` in [../../next.config.ts](../../next.config.ts) for non-prod.
**Fix**: Pass `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` as build args. Current config only uploads in production — that's intentional.

### Serwist service worker cache stuck

**Cause**: `public/sw.js` is precached; users on old SW keep getting stale chunks.
**Fix**: Serwist sets a new `revision` on every build (see [../../next.config.ts](../../next.config.ts)). If a specific user is stuck: hard reload (Ctrl+Shift+R) or DevTools → Application → Service Workers → Unregister.

### `active-society-id` cookie collision (SA and RWA_ADMIN in same browser)

**Cause**: SA impersonation uses the same cookie as RWA_ADMIN — see CLAUDE.md.
**Fix**: Use incognito, or sign out between roles. Not a deploy issue but a surprisingly common "why is prod acting weird" report.

---

## Rollback didn't help — now what?

If Path A/B from [rollback.md](rollback.md) didn't restore service:

1. **Is the DB the problem?** Check Supabase dashboard → Logs. A migration that broke the schema won't be fixed by a container rollback — see [db-migrations.md](db-migrations.md) for DB recovery.
2. **Is GHCR the problem?** Can you `docker pull ghcr.io/<owner>/rwa:<env>-<sha>` locally? If not, PAT issue.
3. **Is Azure the problem?** Check [status.azure.com](https://status.azure.com) for Central India region incidents.
4. **Nuclear option**: redirect DNS to the old `rwaconnect360` App Service if it's still running. This assumes we haven't decommissioned it yet (the plan keeps it alive for ~7 days after prod cutover).

---

## Incidents log

Add a dated entry per incident: what broke, time to detect, time to resolve, root cause, what we changed.

_(empty — populate as incidents occur)_
