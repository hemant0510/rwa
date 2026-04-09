#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Azure Infrastructure Setup for RWA Connect
#
# This script creates all Azure resources for dev, staging,
# and production environments using Azure Container Apps.
#
# Prerequisites:
#   1. Azure CLI installed: https://aka.ms/InstallAzureCLIDeb
#   2. Logged in: az login
#   3. Correct subscription set: az account set --subscription <id>
#
# Usage:
#   chmod +x infra/setup-azure.sh
#   ./infra/setup-azure.sh
# ─────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuration ──
LOCATION="centralindia"          # Closest to Supabase ap-south-1
ACR_NAME="rwaconnect"            # Must be globally unique (lowercase, no dashes)
SHARED_RG="rwa-shared"

echo "============================================"
echo " RWA Connect — Azure Infrastructure Setup"
echo "============================================"
echo ""

# ── 1. Shared Resources (Container Registry) ──
echo "▶ Creating shared resource group..."
az group create --name "$SHARED_RG" --location "$LOCATION" --output none

echo "▶ Creating Azure Container Registry: $ACR_NAME..."
az acr create \
  --resource-group "$SHARED_RG" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --output none

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
echo "  → ACR: $ACR_LOGIN_SERVER"

# ── Function to create an environment ──
create_environment() {
  local ENV_NAME=$1
  local RG="rwa-${ENV_NAME}"
  local ENV="rwa-env-${ENV_NAME}"
  local APP="rwa-app-${ENV_NAME}"
  local MIN_REPLICAS=$2
  local MAX_REPLICAS=$3
  local CPU=$4
  local MEMORY=$5

  echo ""
  echo "── Creating $ENV_NAME environment ──"

  echo "▶ Resource group: $RG"
  az group create --name "$RG" --location "$LOCATION" --output none

  echo "▶ Container Apps environment: $ENV"
  az containerapp env create \
    --name "$ENV" \
    --resource-group "$RG" \
    --location "$LOCATION" \
    --output none

  echo "▶ Container App: $APP (CPU: $CPU, Memory: $MEMORY, Replicas: $MIN_REPLICAS-$MAX_REPLICAS)"
  az containerapp create \
    --name "$APP" \
    --resource-group "$RG" \
    --environment "$ENV" \
    --image "mcr.microsoft.com/k8se/quickstart:latest" \
    --registry-server "$ACR_LOGIN_SERVER" \
    --registry-username "$(az acr credential show --name "$ACR_NAME" --query username -o tsv)" \
    --registry-password "$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)" \
    --target-port 3000 \
    --ingress external \
    --min-replicas "$MIN_REPLICAS" \
    --max-replicas "$MAX_REPLICAS" \
    --cpu "$CPU" \
    --memory "$MEMORY" \
    --output none

  FQDN=$(az containerapp show --name "$APP" --resource-group "$RG" --query "properties.configuration.ingress.fqdn" -o tsv)
  echo "  → URL: https://$FQDN"
}

# ── 2. Create all three environments ──
#                    env       min  max  cpu   memory
create_environment  "dev"      0    1    0.5   "1Gi"
create_environment  "staging"  1    2    0.5   "1Gi"
create_environment  "prod"     1    10   1     "2Gi"

# ── 3. Create Service Principal for GitHub Actions ──
echo ""
echo "── Creating Service Principal for CI/CD ──"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

SP_OUTPUT=$(az ad sp create-for-rbac \
  --name "rwa-github-actions" \
  --role contributor \
  --scopes "/subscriptions/$SUBSCRIPTION_ID" \
  --sdk-auth 2>/dev/null || true)

echo ""
echo "============================================"
echo " ✅ Infrastructure created successfully!"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "1. GITHUB ENVIRONMENTS — Go to repo Settings → Environments and create:"
echo "   • dev        (no protection rules)"
echo "   • staging    (optional: require reviewer)"
echo "   • production (REQUIRED: add required reviewers)"
echo ""
echo "2. GITHUB VARIABLES — Go to Settings → Secrets and variables → Actions → Variables:"
echo "   ┌─────────────────────────┬──────────────────────┐"
echo "   │ Variable                │ Value                │"
echo "   ├─────────────────────────┼──────────────────────┤"
echo "   │ ACR_NAME                │ $ACR_NAME            │"
echo "   │ DEV_RESOURCE_GROUP      │ rwa-dev              │"
echo "   │ DEV_APP_NAME            │ rwa-app-dev          │"
echo "   │ STAGING_RESOURCE_GROUP  │ rwa-staging          │"
echo "   │ STAGING_APP_NAME        │ rwa-app-staging      │"
echo "   │ PROD_RESOURCE_GROUP     │ rwa-prod             │"
echo "   │ PROD_APP_NAME           │ rwa-app-prod         │"
echo "   └─────────────────────────┴──────────────────────┘"
echo ""
echo "3. GITHUB SECRETS — Add these per-environment secrets:"
echo "   (Settings → Environments → [env] → Environment secrets)"
echo ""
echo "   ALL environments need:"
echo "   • AZURE_CLIENT_ID"
echo "   • AZURE_TENANT_ID"
echo "   • AZURE_SUBSCRIPTION_ID"
echo ""
echo "   Per environment (different values for dev/staging/prod):"
echo "   • DATABASE_URL"
echo "   • DIRECT_URL"
echo "   • NEXT_PUBLIC_SUPABASE_URL"
echo "   • NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "   • SUPABASE_SERVICE_ROLE_KEY"
echo "   • NEXT_PUBLIC_APP_URL"
echo "   • SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM"
echo "   • NEXT_PUBLIC_SENTRY_DSN"
echo "   • WATI_API_URL, WATI_API_KEY"
echo ""
echo "4. CONFIGURE FEDERATED CREDENTIALS (for passwordless auth):"
echo "   az ad app federated-credential create \\"
echo "     --id <APP_OBJECT_ID> \\"
echo "     --parameters '{\"name\":\"github-dev\",\"issuer\":\"https://token.actions.githubusercontent.com\",\"subject\":\"repo:hemant0510/rwa:environment:dev\",\"audiences\":[\"api://AzureADTokenExchange\"]}'"
echo ""
echo "   Repeat for 'staging' and 'production' environments."
echo ""
echo "Subscription ID: $SUBSCRIPTION_ID"
