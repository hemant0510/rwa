# Observability — Where to look when X

Four surfaces, each answers a different question. Use this table as the first step when something is off.

| What you want to know                        | Where                                                             | How                                        |
| -------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| Is a deploy running right now?               | GitHub → Actions                                                  | Yellow dot next to the commit              |
| Build or push failed?                        | Same, open the run                                                | Red X + click failing step for trace       |
| What image is live?                          | Azure Portal → Container App → Revisions                          | Active revision shows full image tag (SHA) |
| Revision history                             | CLI (below)                                                       | Last 100 revisions retained by default     |
| Live container logs (stdout/stderr)          | CLI (below)                                                       | Streams in real time                       |
| HTTP errors, slow requests, aggregates       | Log Analytics — `rwa-logs`                                        | KQL (examples below)                       |
| Application errors, grouped, with stacktrace | Sentry                                                            | Issue list, env filter                     |
| Who approved the last prod deploy?           | GitHub run → Environments                                         | Reviewer + timestamp                       |
| Current env vars / secrets                   | Azure Portal → Container App → Containers → Environment variables | Secrets show as `[Secret: <name>]`         |

---

## The four surfaces

### 1. GitHub Actions — "what's the pipeline doing?"

- Repo → Actions tab.
- Each push shows up as a run. Yellow = running, green = done, red = failed, grey = queued.
- Click a run to see per-step logs. The build step prints `docker buildx` output; the deploy step prints `az containerapp update` output.
- For prod: the run pauses at the "Approve production deployment" step until a reviewer clicks Approve on the Environments tab.

### 2. Azure Container Apps — "what's deployed, and how is it running?"

Live log stream (follow mode):

```bash
az containerapp logs show \
  --name rwa-<env> \
  --resource-group rwa-rg-centralindia \
  --follow
```

List revisions (who's active, who's dormant):

```bash
az containerapp revision list \
  --name rwa-<env> \
  --resource-group rwa-rg-centralindia \
  --query "[].{name:name, active:properties.active, traffic:properties.trafficWeight, image:properties.template.containers[0].image, created:properties.createdTime}" \
  -o table
```

Portal route: Azure Portal → Container Apps → `rwa-<env>` → **Revisions and replicas** (current traffic split) or **Log stream** (live tail in browser).

### 3. Log Analytics — "aggregate questions, KQL, history"

Workspace: `rwa-logs`. All three apps stream here. Filter with `ContainerAppName_s`.

Open: Azure Portal → Log Analytics Workspaces → `rwa-logs` → Logs.

**Useful KQL queries**:

Last 30 min of errors, any env:

```kusto
ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(30m)
| where Log_s contains "error" or Log_s contains "ERROR"
| project TimeGenerated, ContainerAppName_s, Log_s
| order by TimeGenerated desc
```

5xx response rate per env over last hour (from stdout request logs):

```kusto
ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(1h)
| where Log_s matches regex @"\s5\d{2}\s"
| summarize count() by bin(TimeGenerated, 5m), ContainerAppName_s
| render timechart
```

Cold start detection (container just started):

```kusto
ContainerAppSystemLogs_CL
| where TimeGenerated > ago(24h)
| where Reason_s == "Normal" and Log_s contains "Replica has been started"
| project TimeGenerated, ContainerAppName_s, RevisionName_s
| order by TimeGenerated desc
```

Top noisy log lines (finds a runaway loop):

```kusto
ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(1h)
| summarize count() by Log_s
| top 20 by count_
```

### 4. Sentry — "application errors, grouped, with stacktrace"

Already wired via `@sentry/nextjs`. Env tag auto-set from `NODE_ENV` + release tag set from the deployed SHA.

- Open the Sentry project → Issues.
- Filter by environment (`production` / `staging` / `development`).
- Each issue shows frequency, first-seen, last-seen, affected users, full stacktrace, breadcrumbs, and the release (image SHA).
- Link from an issue to the exact deploy in GitHub Actions via the release tag.

---

## Alerting (minimum bar)

Configure in Azure Portal → Monitor → Alerts, scoped to the `rwa-logs` workspace:

1. **5xx spike**: if the 5xx KQL above returns > 20 rows in any 5-min window → email.
2. **Cold-start cascade**: > 5 replica restarts in 10 min on `rwa-prod` → email.
3. **No logs for 10 min on `rwa-prod`**: likely means the container is wedged → email.

Sentry handles application-error alerting natively — configure per-issue thresholds in the Sentry project.

---

## Quick reference: env names

| Context          | dev                                      | stage                                      | prod                                      |
| ---------------- | ---------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| Branch           | `develop`                                | `staging`                                  | `main`                                    |
| Container App    | `rwa-dev`                                | `rwa-stage`                                | `rwa-prod`                                |
| URL              | `rwa-dev.<region>.azurecontainerapps.io` | `rwa-stage.<region>.azurecontainerapps.io` | `rwa-prod.<region>.azurecontainerapps.io` |
| Supabase project | `rwa-dev`                                | `rwa-stage`                                | `rwa-prod`                                |
| Sentry env       | `development`                            | `staging`                                  | `production`                              |
