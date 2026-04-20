#!/usr/bin/env bash
# Azure infrastructure setup — Phase 2 of deployment/plan.md
#
# STATUS: INERT. This script is ordered az CLI commands for one-time Azure
# provisioning. Review and run sections manually — do NOT execute the whole
# file unattended. Each block is idempotent (create-if-not-exists pattern).
#
# Prereqs:
#   - az CLI logged in: `az login`
#   - Subscription selected: `az account set --subscription <id>`
#   - Region must match the existing rwaconnect360 App Service (Central India).
#
# Fill in the placeholders marked with <...> before running any block.

set -euo pipefail

# ─────────────────────────────────────────────
# 0. Variables — edit these before running anything
# ─────────────────────────────────────────────
SUBSCRIPTION_ID="<azure-subscription-id>"
LOCATION="centralindia"
RG="rwa-rg-centralindia"
LOG_WORKSPACE="rwa-logs"
APP_INSIGHTS="rwa-appinsights"
CA_ENV="rwa-env"

GHCR_OWNER="<github-username-or-org>"           # lowercase
GHCR_READ_TOKEN="<fine-grained-PAT-read-packages>"
GHCR_USER="<github-username>"
IMAGE_BASE="ghcr.io/${GHCR_OWNER}/rwa"

# ─────────────────────────────────────────────
# 1. Resource group
# ─────────────────────────────────────────────
az account set --subscription "$SUBSCRIPTION_ID"

az group create \
  --name "$RG" \
  --location "$LOCATION"

# ─────────────────────────────────────────────
# 2. Log Analytics Workspace (shared across all envs)
# ─────────────────────────────────────────────
az monitor log-analytics workspace create \
  --resource-group "$RG" \
  --workspace-name "$LOG_WORKSPACE" \
  --location "$LOCATION"

WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group "$RG" --workspace-name "$LOG_WORKSPACE" \
  --query customerId -o tsv)

WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group "$RG" --workspace-name "$LOG_WORKSPACE" \
  --query primarySharedKey -o tsv)

# ─────────────────────────────────────────────
# 3. Application Insights (resource only, no SDK)
#    Workspace-based so it co-exists with Log Analytics.
# ─────────────────────────────────────────────
az extension add --name application-insights --upgrade --yes

WORKSPACE_RESOURCE_ID=$(az monitor log-analytics workspace show \
  --resource-group "$RG" --workspace-name "$LOG_WORKSPACE" \
  --query id -o tsv)

az monitor app-insights component create \
  --app "$APP_INSIGHTS" \
  --location "$LOCATION" \
  --resource-group "$RG" \
  --workspace "$WORKSPACE_RESOURCE_ID" \
  --application-type web

# ─────────────────────────────────────────────
# 4. Container Apps Environment (shared)
# ─────────────────────────────────────────────
az extension add --name containerapp --upgrade --yes
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

az containerapp env create \
  --name "$CA_ENV" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --logs-workspace-id "$WORKSPACE_ID" \
  --logs-workspace-key "$WORKSPACE_KEY"

# ─────────────────────────────────────────────
# 5. Three Container Apps (one per env)
#    Run each block separately. Fill env-specific values from the per-env
#    Supabase project dashboards before running.
# ─────────────────────────────────────────────

# ---------- 5a. rwa-dev ----------
APP_NAME="rwa-dev"
MIN_REPLICAS=0
MAX_REPLICAS=2
IMAGE_TAG="${IMAGE_BASE}:dev-latest"       # updated by CI on every deploy

# Placeholder env values — replace with real dev Supabase project values
DEV_NEXT_PUBLIC_SUPABASE_URL="<dev-supabase-url>"
DEV_NEXT_PUBLIC_SUPABASE_ANON_KEY="<dev-anon-key>"
DEV_NEXT_PUBLIC_APP_URL="https://rwa-dev.<region>.azurecontainerapps.io"
DEV_APP_URL="$DEV_NEXT_PUBLIC_APP_URL"
DEV_DATABASE_URL="<dev-pooler-6543-url>"
DEV_DIRECT_URL="<dev-direct-5432-url>"
DEV_SUPABASE_SERVICE_ROLE_KEY="<dev-service-role-key>"
DEV_SMTP_HOST="smtp.gmail.com"
DEV_SMTP_PORT="587"
DEV_SMTP_USER="<dev-smtp-user>"
DEV_SMTP_PASS="<dev-smtp-pass>"
DEV_SMTP_FROM="RWA Connect <${DEV_SMTP_USER}>"
DEV_NEXT_PUBLIC_SENTRY_DSN="<sentry-dsn>"

az containerapp create \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --environment "$CA_ENV" \
  --image "$IMAGE_TAG" \
  --target-port 3000 \
  --ingress external \
  --transport auto \
  --min-replicas "$MIN_REPLICAS" \
  --max-replicas "$MAX_REPLICAS" \
  --cpu 0.5 --memory 1.0Gi \
  --registry-server ghcr.io \
  --registry-username "$GHCR_USER" \
  --registry-password "$GHCR_READ_TOKEN" \
  --secrets \
    "database-url=${DEV_DATABASE_URL}" \
    "direct-url=${DEV_DIRECT_URL}" \
    "supabase-service-role-key=${DEV_SUPABASE_SERVICE_ROLE_KEY}" \
    "smtp-pass=${DEV_SMTP_PASS}" \
    "ghcr-token=${GHCR_READ_TOKEN}" \
  --env-vars \
    "NODE_ENV=production" \
    "NEXT_PUBLIC_SUPABASE_URL=${DEV_NEXT_PUBLIC_SUPABASE_URL}" \
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=${DEV_NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
    "NEXT_PUBLIC_APP_URL=${DEV_NEXT_PUBLIC_APP_URL}" \
    "APP_URL=${DEV_APP_URL}" \
    "SMTP_HOST=${DEV_SMTP_HOST}" \
    "SMTP_PORT=${DEV_SMTP_PORT}" \
    "SMTP_USER=${DEV_SMTP_USER}" \
    "SMTP_FROM=${DEV_SMTP_FROM}" \
    "NEXT_PUBLIC_SENTRY_DSN=${DEV_NEXT_PUBLIC_SENTRY_DSN}" \
    "TRIAL_PERIOD_DAYS=14" \
    "MAX_TRIAL_RESIDENTS=50" \
    "DATABASE_URL=secretref:database-url" \
    "DIRECT_URL=secretref:direct-url" \
    "SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role-key" \
    "SMTP_PASS=secretref:smtp-pass"

# Liveness probe on /api/health — set after create because az containerapp
# create doesn't take probes inline; use YAML overlay or `az containerapp update`.
# Apply probes with: az containerapp update --yaml <probes.yaml>
# See deployment/runbooks/troubleshooting.md for the target-port gotcha.

# ---------- 5b. rwa-stage ----------
# Duplicate the rwa-dev block with:
#   APP_NAME="rwa-stage"
#   IMAGE_TAG="${IMAGE_BASE}:stage-latest"
#   MAX_REPLICAS=2
#   All STAGE_* values from the stage Supabase project.

# ---------- 5c. rwa-prod ----------
# Duplicate the rwa-dev block with:
#   APP_NAME="rwa-prod"
#   IMAGE_TAG="${IMAGE_BASE}:prod-latest"
#   MAX_REPLICAS=3
#   All PROD_* values from the prod Supabase project.

# ─────────────────────────────────────────────
# 6. OIDC federated identity (reuses existing rwaconnect360 creds)
#    The develop_rwaconnect360.yml workflow already has AZURE_CLIENT_ID /
#    TENANT_ID / SUBSCRIPTION_ID set up. Extend the app registration's
#    federated credential list to include:
#      - refs/heads/develop  →  deploy-dev.yml
#      - refs/heads/staging  →  deploy-stage.yml
#      - refs/heads/main     →  deploy-prod.yml
#      - environment:production (for the prod approval gate)
#
#    Add these via Azure Portal → App Registration → Certificates & secrets →
#    Federated credentials → "Add credential".
# ─────────────────────────────────────────────

# ─────────────────────────────────────────────
# 7. Verification
# ─────────────────────────────────────────────
az containerapp list --resource-group "$RG" -o table
az containerapp env show --name "$CA_ENV" --resource-group "$RG" --query "properties.provisioningState" -o tsv
# Expect "Succeeded" and three apps listed.

echo "Infrastructure ready. Now wire the three GitHub Actions workflows (Phase 5)."
