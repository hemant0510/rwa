# Rollback — RWA Connect (Azure Container Apps)

Two paths. Pick based on urgency and what's known-good.

- **Path A — Re-point image** (~30 s): you know a previous image SHA that was healthy in this env. This is the most common rollback and what the rollback drill in the plan tests.
- **Path B — Activate prior revision** (~10 s): the previous revision is still listed on the Container App. Fastest, but only works if the revision hasn't aged out (Container Apps keeps the last 100 by default).

Both paths bypass CI. Do not use them for routine deploys — they leave `:<env>-latest` and the main branch in disagreement. After rollback, open a revert PR so Git matches reality.

---

## Pre-rollback (30 seconds)

1. **Confirm you're on the right env.** `rwa-prod` vs `rwa-stage` matters.
   ```bash
   az containerapp show --name rwa-prod --resource-group rwa-rg-centralindia --query "properties.latestRevisionName" -o tsv
   ```
2. **Capture the current bad state** for the post-mortem — note the failing revision name and the image tag.
   ```bash
   az containerapp revision list --name rwa-prod --resource-group rwa-rg-centralindia \
     --query "[?properties.active].{name:name, image:properties.template.containers[0].image, created:properties.createdTime}" -o table
   ```
3. **Tell #ops** (or whatever channel) you're rolling back and why.

---

## Path A — Re-point to previous image (~30 s)

Use when you know which SHA was healthy.

1. **List recent image tags** from GHCR (GitHub → repo → Packages → `rwa`):
   - Look for the most recent `prod-<sha>` before the bad one.
   - Or check the Actions history for the last green prod deploy.

2. **Update the Container App** to pull that image:

   ```bash
   az containerapp update \
     --name rwa-prod \
     --resource-group rwa-rg-centralindia \
     --image ghcr.io/<owner>/rwa:prod-<previous-sha>
   ```

3. **Watch the revision come up:**

   ```bash
   az containerapp revision list --name rwa-prod --resource-group rwa-rg-centralindia -o table
   ```

   New revision should appear `Provisioning` → `Running` → `Active`. ~30 s total.

4. **Smoke-test:**

   ```bash
   curl -fsS https://rwa-prod.<region>.azurecontainerapps.io/api/health
   ```

5. **Check logs for the new revision:**
   ```bash
   az containerapp logs show --name rwa-prod --resource-group rwa-rg-centralindia --follow
   ```

---

## Path B — Activate prior revision (~10 s)

Use when the previous revision is still listed on the Container App. No image pull → faster.

1. **Find the last known-good revision:**

   ```bash
   az containerapp revision list --name rwa-prod --resource-group rwa-rg-centralindia \
     --query "[].{name:name, active:properties.active, created:properties.createdTime, image:properties.template.containers[0].image}" \
     -o table
   ```

2. **Activate it:**

   ```bash
   az containerapp revision activate \
     --name rwa-prod \
     --resource-group rwa-rg-centralindia \
     --revision <previous-revision-name>
   ```

3. **Shift 100% traffic** (Container Apps defaults to the latest, so this is the critical step):

   ```bash
   az containerapp ingress traffic set \
     --name rwa-prod \
     --resource-group rwa-rg-centralindia \
     --revision-weight <previous-revision-name>=100
   ```

4. **Deactivate the bad revision** (optional but cleaner):

   ```bash
   az containerapp revision deactivate \
     --name rwa-prod \
     --resource-group rwa-rg-centralindia \
     --revision <bad-revision-name>
   ```

5. **Smoke-test** (same `curl` as Path A).

---

## Database rollback (separate concern)

Container rollback reverts the app. It does **not** revert DB migrations. If the bad deploy ran a destructive migration:

1. **Stop new writes** — scale app to 0 replicas:
   ```bash
   az containerapp update --name rwa-prod --resource-group rwa-rg-centralindia --min-replicas 0 --max-replicas 0
   ```
2. **Restore Supabase** from the daily backup via Supabase Dashboard → Database → Backups.
3. **Scale back up** after restore completes.
4. See [db-migrations.md](db-migrations.md) for the full recovery procedure and why we use expand-contract to avoid this path.

---

## Post-rollback checklist

- [ ] App healthy — `/api/health` returns 200.
- [ ] Log Analytics: no 5xx spike in last 5 min.
- [ ] Sentry: no new issue group appearing.
- [ ] File a revert PR so `main` matches the deployed code.
- [ ] Write a short post-mortem in [troubleshooting.md](troubleshooting.md) under "Incidents" — what broke, how we spotted it, how long to rollback.
