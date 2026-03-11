# ╔═══════════════════════════════════════════════════════════╗
# ║           RWA Connect — Developer Commands               ║
# ║                                                           ║
# ║  Run `make` or `make help` to see all available targets   ║
# ╚═══════════════════════════════════════════════════════════╝

.PHONY: dev build start lint fix format format-check check test tw coverage \
        db-push db-pull db-generate db-studio \
        db-migrate db-migrate-deploy db-reset \
        db-seed db-seed-master db-seed-dev \
        setup install clean ready help

# ─────────────────────────────────────────────────────────────
#  Dev & Build
# ─────────────────────────────────────────────────────────────

dev:              ## Start Next.js dev server (http://localhost:3000)
	npm run dev

build:            ## Production build (Prisma generate + Next.js)
	npm run build

start:            ## Start production server
	npm start

# ─────────────────────────────────────────────────────────────
#  Code Quality
# ─────────────────────────────────────────────────────────────

lint:             ## Run ESLint
	npm run lint

fix:              ## Auto-fix lint issues
	npm run lint:fix

format:           ## Format all files with Prettier
	npm run format

format-check:     ## Check formatting without writing
	npm run format:check

check:            ## Full check — TypeScript + ESLint + Prettier
	npm run check

ready:            ## Pre-commit check — lint + format + type-check + tests
	npm run check && npm test

# ─────────────────────────────────────────────────────────────
#  Tests
# ─────────────────────────────────────────────────────────────

test:             ## Run all tests once
	npm test

tw:               ## Run tests in watch mode
	npm run test:watch

coverage:         ## Run tests with per-file coverage report
	npm run test:coverage

# ─────────────────────────────────────────────────────────────
#  Database — Schema & Client
# ─────────────────────────────────────────────────────────────

db-generate:      ## Regenerate Prisma client from dbinuse.prisma
	npm run db:generate

db-push:          ## Push dbinuse.prisma schema → Supabase DB
	npm run db:push

db-pull:          ## Pull remote DB schema → dbinuse.prisma
	npm run db:pull

db-studio:        ## Open Prisma Studio (visual DB browser)
	npm run db:studio

# ─────────────────────────────────────────────────────────────
#  Database — Migrations
# ─────────────────────────────────────────────────────────────

db-migrate:       ## Create a new tracked migration (dev)
	npm run db:migrate

db-migrate-deploy: ## Apply pending migrations (production)
	npm run db:migrate:deploy

db-reset:         ## Reset DB + replay all migrations + seed
	npm run db:reset

# ─────────────────────────────────────────────────────────────
#  Database — Seeding
# ─────────────────────────────────────────────────────────────

db-seed:          ## Seed database (default seed.ts)
	npm run db:seed

db-seed-master:   ## Fresh setup — SuperAdmin + platform plans only
	npm run db:seed:master

db-seed-dev:      ## Full demo — societies, residents, fees, expenses
	npm run db:seed:dev

# ─────────────────────────────────────────────────────────────
#  Setup & Maintenance
# ─────────────────────────────────────────────────────────────

install:          ## Install npm dependencies
	npm install

setup:            ## First-time setup — install + generate Prisma client
	npm install && npm run db:generate

clean:            ## Remove build artifacts and caches
	rm -rf .next node_modules/.cache

# ─────────────────────────────────────────────────────────────
#  Help
# ─────────────────────────────────────────────────────────────

help:             ## Show all available commands
	@echo ""
	@echo "  RWA Connect — Available Commands"
	@echo "  ─────────────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

.DEFAULT_GOAL := help
