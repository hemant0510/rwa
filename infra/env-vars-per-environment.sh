#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Set environment variables on Azure Container Apps
#
# Usage:
#   # Edit the values below for each environment, then run:
#   ./infra/env-vars-per-environment.sh dev
#   ./infra/env-vars-per-environment.sh staging
#   ./infra/env-vars-per-environment.sh prod
# ─────────────────────────────────────────────────────────
set -euo pipefail

ENV="${1:?Usage: $0 <dev|staging|prod>}"
APP_NAME="rwa-app-${ENV}"
RESOURCE_GROUP="rwa-${ENV}"

# ─────────────────────────────────────────────────────────
# EDIT THESE VALUES FOR EACH ENVIRONMENT
# ─────────────────────────────────────────────────────────
case "$ENV" in
  dev)
    SUPABASE_URL="https://YOUR_DEV_PROJECT.supabase.co"
    SUPABASE_ANON_KEY="YOUR_DEV_ANON_KEY"
    SUPABASE_SERVICE_KEY="YOUR_DEV_SERVICE_ROLE_KEY"
    DATABASE_URL="postgresql://postgres.YOUR_DEV_REF:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    DIRECT_URL="postgresql://postgres.YOUR_DEV_REF:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
    APP_URL="https://dev.yourdomain.com"
    SENTRY_DSN=""
    SMTP_HOST="smtp.gmail.com"
    SMTP_PORT="587"
    SMTP_USER="dev@yourdomain.com"
    SMTP_PASS="xxxx-xxxx-xxxx-xxxx"
    SMTP_FROM="RWA Connect Dev <dev@yourdomain.com>"
    WATI_API_URL=""
    WATI_API_KEY=""
    TRIAL_PERIOD_DAYS="14"
    MAX_TRIAL_RESIDENTS="50"
    ;;
  staging)
    SUPABASE_URL="https://YOUR_STAGING_PROJECT.supabase.co"
    SUPABASE_ANON_KEY="YOUR_STAGING_ANON_KEY"
    SUPABASE_SERVICE_KEY="YOUR_STAGING_SERVICE_ROLE_KEY"
    DATABASE_URL="postgresql://postgres.YOUR_STAGING_REF:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    DIRECT_URL="postgresql://postgres.YOUR_STAGING_REF:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
    APP_URL="https://staging.yourdomain.com"
    SENTRY_DSN=""
    SMTP_HOST="smtp.gmail.com"
    SMTP_PORT="587"
    SMTP_USER="staging@yourdomain.com"
    SMTP_PASS="xxxx-xxxx-xxxx-xxxx"
    SMTP_FROM="RWA Connect Staging <staging@yourdomain.com>"
    WATI_API_URL=""
    WATI_API_KEY=""
    TRIAL_PERIOD_DAYS="14"
    MAX_TRIAL_RESIDENTS="50"
    ;;
  prod)
    SUPABASE_URL="https://YOUR_PROD_PROJECT.supabase.co"
    SUPABASE_ANON_KEY="YOUR_PROD_ANON_KEY"
    SUPABASE_SERVICE_KEY="YOUR_PROD_SERVICE_ROLE_KEY"
    DATABASE_URL="postgresql://postgres.YOUR_PROD_REF:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    DIRECT_URL="postgresql://postgres.YOUR_PROD_REF:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
    APP_URL="https://app.yourdomain.com"
    SENTRY_DSN="https://YOUR_SENTRY_DSN"
    SMTP_HOST="smtp.gmail.com"
    SMTP_PORT="587"
    SMTP_USER="noreply@yourdomain.com"
    SMTP_PASS="xxxx-xxxx-xxxx-xxxx"
    SMTP_FROM="RWA Connect <noreply@yourdomain.com>"
    WATI_API_URL="https://live-mt-server.wati.io"
    WATI_API_KEY="YOUR_WATI_KEY"
    TRIAL_PERIOD_DAYS="14"
    MAX_TRIAL_RESIDENTS="50"
    ;;
  *)
    echo "Invalid environment: $ENV (use dev, staging, or prod)"
    exit 1
    ;;
esac

echo "Setting env vars for $APP_NAME in $RESOURCE_GROUP..."

az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars \
    "NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL" \
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" \
    "SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-key" \
    "DATABASE_URL=secretref:database-url" \
    "DIRECT_URL=secretref:direct-url" \
    "NEXT_PUBLIC_APP_URL=$APP_URL" \
    "NEXT_PUBLIC_SENTRY_DSN=$SENTRY_DSN" \
    "SMTP_HOST=$SMTP_HOST" \
    "SMTP_PORT=$SMTP_PORT" \
    "SMTP_USER=$SMTP_USER" \
    "SMTP_PASS=secretref:smtp-pass" \
    "SMTP_FROM=$SMTP_FROM" \
    "WATI_API_URL=$WATI_API_URL" \
    "WATI_API_KEY=secretref:wati-api-key" \
    "TRIAL_PERIOD_DAYS=$TRIAL_PERIOD_DAYS" \
    "MAX_TRIAL_RESIDENTS=$MAX_TRIAL_RESIDENTS" \
    "NODE_ENV=production"

echo ""
echo "⚠️  Sensitive values should be stored as Container App secrets:"
echo "   az containerapp secret set --name $APP_NAME --resource-group $RESOURCE_GROUP --secrets \\"
echo "     supabase-service-key=$SUPABASE_SERVICE_KEY \\"
echo "     database-url='$DATABASE_URL' \\"
echo "     direct-url='$DIRECT_URL' \\"
echo "     smtp-pass=$SMTP_PASS \\"
echo "     wati-api-key=$WATI_API_KEY"
echo ""
echo "✅ Environment variables set for $ENV"
