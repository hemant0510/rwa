# Custom Domain Binding — `rwaconnect360.com`

One-time procedure to bind the GoDaddy domain `rwaconnect360.com` (and subdomains) to the three Azure Container Apps. Repeat per-env; commands are nearly identical.

## Target mapping

| Env   | Branch    | Container App | Custom domain              | Routing record | Ownership record  |
| ----- | --------- | ------------- | -------------------------- | -------------- | ----------------- |
| dev   | `develop` | `rwa-dev`     | `dev.rwaconnect360.com`    | `CNAME dev`    | `TXT asuid.dev`   |
| stage | `staging` | `rwa-stage`   | `stage.rwaconnect360.com`  | `CNAME stage`  | `TXT asuid.stage` |
| prod  | `main`    | `rwa-prod`    | `rwaconnect360.com` (apex) | `A @`          | `TXT asuid`       |
| prod  | `main`    | `rwa-prod`    | `www.rwaconnect360.com`    | `CNAME www`    | `TXT asuid.www`   |

**Important notes:**

- **Both records are required for every hostname** — routing (CNAME or A) makes traffic reach Azure; TXT (`asuid.<sub>`) proves you own the domain so Azure will issue a free managed cert. The portal's "Validation method" radio button does NOT skip the TXT requirement; both records must exist before the portal will validate.
- The custom domain is **added on top of** the existing `*.azurecontainerapps.io` URL — it does NOT replace it. The default URL keeps working as a fallback.

---

## Prerequisites

- The target Container App exists in `rwa-rg-centralindia` (e.g. `rwa-dev` is already deployed; `rwa-stage` and `rwa-prod` must be created via [scripts/azure-setup.sh](../scripts/azure-setup.sh) before their domains can be bound).
- GoDaddy account access for `rwaconnect360.com`.
- Azure CLI logged in to the correct subscription: `az login` and `az account set --subscription <id>`.
- `containerapp` extension installed: `az extension add --name containerapp --upgrade --yes`.

---

## Step 0 — Discover the environment's verification ID and static IP

Both are tied to the **Container Apps Environment**, not individual apps. The verification ID is reused across every domain in the env; the static IP is needed only for apex (A record).

```bash
# Get the environment name from the existing app
ENV_ID=$(az containerapp show --name rwa-dev --resource-group rwa-rg-centralindia --query "properties.environmentId" -o tsv)
ENV_NAME=$(basename "$ENV_ID")
echo "Environment name: $ENV_NAME"

# Pull verification ID + static IP in one call
az containerapp env show \
  --name "$ENV_NAME" \
  --resource-group rwa-rg-centralindia \
  --query "{verificationId:properties.customDomainConfiguration.customDomainVerificationId, staticIp:properties.staticIp}" \
  -o tsv
```

Record both values — every binding step below uses them.

---

## Step 1 — GoDaddy DNS records

In GoDaddy → My Products → `rwaconnect360.com` → DNS → Manage Zones, add these records. **Do this BEFORE running the Azure `bind` commands** — the bind step will fail validation if DNS isn't propagated.

| Type    | Name          | Value                                                               | TTL    | Purpose                   |
| ------- | ------------- | ------------------------------------------------------------------- | ------ | ------------------------- |
| `CNAME` | `dev`         | `rwa-dev.<env-default-domain>.centralindia.azurecontainerapps.io`   | 1 Hour | dev hostname              |
| `TXT`   | `asuid.dev`   | `<verification-id from Step 0>`                                     | 1 Hour | validates dev ownership   |
| `CNAME` | `stage`       | `rwa-stage.<env-default-domain>.centralindia.azurecontainerapps.io` | 1 Hour | stage hostname            |
| `TXT`   | `asuid.stage` | `<verification-id from Step 0>`                                     | 1 Hour | validates stage ownership |
| `A`     | `@`           | `<static-ip from Step 0>`                                           | 1 Hour | apex → prod               |
| `TXT`   | `asuid`       | `<verification-id from Step 0>`                                     | 1 Hour | validates apex ownership  |
| `CNAME` | `www`         | `rwa-prod.<env-default-domain>.centralindia.azurecontainerapps.io`  | 1 Hour | www → prod                |

> The current env-default-domain prefix can be read off the existing URL:
> `rwa-dev.grayfield-758e8533.centralindia.azurecontainerapps.io` → use `grayfield-758e8533.centralindia.azurecontainerapps.io`.

**Verify DNS propagation** before moving on (usually 5–15 min on GoDaddy):

```bash
nslookup dev.rwaconnect360.com
nslookup -type=TXT asuid.dev.rwaconnect360.com
nslookup rwaconnect360.com    # expect the static IP
```

---

## Step 2 — Bind the hostname in Azure

Run per app. The `bind` step provisions a **free Azure-managed certificate** automatically (~3–5 min on first issuance, auto-renews thereafter).

### 2a — `rwa-dev` (subdomain, CNAME validation)

```bash
az containerapp hostname add \
  --hostname dev.rwaconnect360.com \
  --resource-group rwa-rg-centralindia \
  --name rwa-dev

az containerapp hostname bind \
  --hostname dev.rwaconnect360.com \
  --resource-group rwa-rg-centralindia \
  --name rwa-dev \
  --environment "$ENV_NAME" \
  --validation-method CNAME
```

### 2b — `rwa-stage` (subdomain, CNAME validation)

```bash
az containerapp hostname add \
  --hostname stage.rwaconnect360.com \
  --resource-group rwa-rg-centralindia \
  --name rwa-stage

az containerapp hostname bind \
  --hostname stage.rwaconnect360.com \
  --resource-group rwa-rg-centralindia \
  --name rwa-stage \
  --environment "$ENV_NAME" \
  --validation-method CNAME
```

### 2c — `rwa-prod` (apex, TXT validation + www CNAME)

```bash
# Apex
az containerapp hostname add \
  --hostname rwaconnect360.com \
  --resource-group rwa-rg-centralindia \
  --name rwa-prod

az containerapp hostname bind \
  --hostname rwaconnect360.com \
  --resource-group rwa-rg-centralindia \
  --name rwa-prod \
  --environment "$ENV_NAME" \
  --validation-method TXT

# www
az containerapp hostname add \
  --hostname www.rwaconnect360.com \
  --resource-group rwa-rg-centralindia \
  --name rwa-prod

az containerapp hostname bind \
  --hostname www.rwaconnect360.com \
  --resource-group rwa-rg-centralindia \
  --name rwa-prod \
  --environment "$ENV_NAME" \
  --validation-method CNAME
```

---

## Step 3 — Update `NEXT_PUBLIC_APP_URL` (CRITICAL)

`NEXT_PUBLIC_APP_URL` is **baked into the client bundle at build time** (see [Dockerfile](../../Dockerfile) ARGs and [.github/workflows/deploy-dev.yml](../../.github/workflows/deploy-dev.yml) `build-args`). Updating only the Container App env var will NOT update the client — the client still has the old URL hard-coded in `_next/static/*.js`. You **must** rebuild.

### 3a — Update GitHub repo secrets

GitHub → Settings → Secrets and variables → Actions:

| Secret                      | Old value                                                               | New value                         |
| --------------------------- | ----------------------------------------------------------------------- | --------------------------------- |
| `NEXT_PUBLIC_APP_URL` (dev) | `https://rwa-dev.grayfield-758e8533.centralindia.azurecontainerapps.io` | `https://dev.rwaconnect360.com`   |
| `STAGE_NEXT_PUBLIC_APP_URL` | _(create)_                                                              | `https://stage.rwaconnect360.com` |
| `PROD_NEXT_PUBLIC_APP_URL`  | _(create)_                                                              | `https://rwaconnect360.com`       |

### 3b — Update the Container App runtime env vars (server-side reads)

```bash
# dev
az containerapp update \
  --name rwa-dev \
  --resource-group rwa-rg-centralindia \
  --set-env-vars \
    NEXT_PUBLIC_APP_URL=https://dev.rwaconnect360.com \
    APP_URL=https://dev.rwaconnect360.com

# stage
az containerapp update \
  --name rwa-stage \
  --resource-group rwa-rg-centralindia \
  --set-env-vars \
    NEXT_PUBLIC_APP_URL=https://stage.rwaconnect360.com \
    APP_URL=https://stage.rwaconnect360.com

# prod
az containerapp update \
  --name rwa-prod \
  --resource-group rwa-rg-centralindia \
  --set-env-vars \
    NEXT_PUBLIC_APP_URL=https://rwaconnect360.com \
    APP_URL=https://rwaconnect360.com
```

### 3c — Re-trigger a deploy so the new URL is baked into the client bundle

```bash
git commit --allow-empty -m "chore: rebuild with new NEXT_PUBLIC_APP_URL"
git push origin develop
```

Check GitHub Actions → `deploy-dev.yml` runs → confirm new revision is active.

---

## Step 4 — Update Supabase Auth callback URLs

Supabase magic-link / OAuth flows compare the redirect URL against an allow-list. Without this, sign-in from the new domain fails silently.

For **each Supabase project** (`rwa-connect`, `rwa-connect-prod`):

Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: set to the env's primary domain (`https://dev.rwaconnect360.com` for `rwa-connect`, `https://rwaconnect360.com` for `rwa-connect-prod`).
- **Redirect URLs** (allow-list): add **all** of these so callbacks from any env work:
  - `https://dev.rwaconnect360.com/**`
  - `https://stage.rwaconnect360.com/**`
  - `https://rwaconnect360.com/**`
  - `https://www.rwaconnect360.com/**`
  - `http://localhost:3000/**` (keep for local dev)
  - The default `*.azurecontainerapps.io` URLs (keep as fallback during migration)

---

## Step 5 — Verification

After the redeploy completes:

```bash
# DNS resolves
dig +short dev.rwaconnect360.com
dig +short rwaconnect360.com

# TLS cert is valid and issued by Microsoft / DigiCert
echo | openssl s_client -servername dev.rwaconnect360.com -connect dev.rwaconnect360.com:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates

# Health endpoint responds 200 with the expected body
curl -fsS https://dev.rwaconnect360.com/api/health
curl -fsS https://stage.rwaconnect360.com/api/health
curl -fsS https://rwaconnect360.com/api/health
curl -fsS https://www.rwaconnect360.com/api/health

# Confirm the client bundle has the new URL baked in (search the page source)
curl -s https://dev.rwaconnect360.com/ | grep -o "dev.rwaconnect360.com" | head -1
```

Sign in from the browser on each domain — confirm Supabase auth redirects land on the expected env.

---

## Troubleshooting

| Symptom                                                    | Likely cause                                                       | Fix                                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `bind` fails with `DnsValidationFailed`                    | DNS not propagated yet, OR `asuid` TXT value is wrong              | Wait 10 min, re-check `nslookup -type=TXT asuid.<sub>.rwaconnect360.com`, then re-run `bind`                             |
| `bind` returns "certificate provisioning in progress"      | Normal — Azure is issuing the managed cert                         | Wait 5 min, re-check with `az containerapp hostname list --name rwa-<env> --resource-group rwa-rg-centralindia -o table` |
| Browser shows `NET::ERR_CERT_COMMON_NAME_INVALID`          | Cert not yet bound, OR you're hitting an old cached IP             | Confirm cert is `Bound` status; flush DNS (`ipconfig /flushdns` on Win); incognito tab                                   |
| Sign-in redirects to `azurecontainerapps.io` URL           | `NEXT_PUBLIC_APP_URL` GitHub secret not updated, or no rebuild yet | Re-do Step 3a + 3c                                                                                                       |
| Supabase auth: "Invalid redirect URL"                      | Domain not in Supabase allow-list                                  | Re-do Step 4 for the matching Supabase project                                                                           |
| Apex `rwaconnect360.com` returns DNS error but `www` works | `A` record at `@` missing or pointing to wrong IP                  | Re-check Step 1 apex row; confirm IP from `az containerapp env show ... --query properties.staticIp`                     |
| Hostname `bind` succeeds but `/api/health` returns 404     | Ingress targetPort wrong on Container App                          | `az containerapp ingress update --name rwa-<env> --resource-group rwa-rg-centralindia --target-port 3000`                |
| Container App env was recreated → static IP changed        | Apex A record now points at dead IP                                | Get new IP from `az containerapp env show ...`, update GoDaddy A record                                                  |

---

## Captured infrastructure values (filled in as discovered)

| Value                             | Current                                                            | Notes                                                       |
| --------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Container Apps Env default domain | `grayfield-758e8533.centralindia.azurecontainerapps.io`            | Stable unless env is recreated                              |
| Static IP (env)                   | `20.207.75.107`                                                    | Used as the apex `A @` record value when binding prod       |
| Custom Domain Verification ID     | `9D6D21845BFBB04222C8A2238078CBBE63275A28DD6A9C3146CEEFB1F04067C8` | Same value works for every hostname in this env (env-level) |

## Status

| Hostname                   | Bound to    | Status                           | Cert                             |
| -------------------------- | ----------- | -------------------------------- | -------------------------------- |
| `dev.rwaconnect360.com`    | `rwa-dev`   | ✅ SNI Enabled                   | Azure-managed (free, auto-renew) |
| `stage.rwaconnect360.com`  | `rwa-stage` | ⏳ Pending — app not yet created |                                  |
| `rwaconnect360.com` (apex) | `rwa-prod`  | ⏳ Pending — app not yet created |                                  |
| `www.rwaconnect360.com`    | `rwa-prod`  | ⏳ Pending — app not yet created |                                  |

## Lessons learned (don't repeat these)

- **Hyphen ≠ dot in DNS.** `dev-rwaconnect360.com` is a totally separate domain from `rwaconnect360.com` — it would need to be bought separately. `dev.rwaconnect360.com` is a subdomain in the same zone — what we want. Always use dots for env-prefixed subdomains.

## Operational notes

- **Cert renewal** is automatic (Azure-managed certs renew ~30 days before expiry, no action required).
- **Cert is per-hostname**, not wildcard — each subdomain provisions its own cert.
- **Apex IP fragility:** the Container Apps env's static IP only changes if the env itself is recreated. As long as you don't `az containerapp env delete`, the apex A record is stable. If you ever need a true ALIAS-at-apex (resilient to IP changes), put Azure Front Door in front of `rwa-prod` (~$35/mo) — not justified at current scale.
- **HTTP → HTTPS redirect** is enforced automatically by Container Apps when `--ingress external` is set (the default).
- **Removing a domain** (e.g. retiring an env): `az containerapp hostname delete --hostname <fqdn> --name rwa-<env> --resource-group rwa-rg-centralindia`.

---

## Related

- [plan.md § Phase 7 — Custom domain mapping](../plan.md)
- [observability.md](observability.md) — where to look when traffic on a new domain misbehaves
- [troubleshooting.md](troubleshooting.md) — broader Container App failure modes
