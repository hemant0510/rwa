.PHONY: dev build start lint fix format check test tw db-push db-pull db-seed db-studio db-generate db-migrate db-reset install clean

# ── Dev & Build ──────────────────────────────
dev:            ## Start dev server
	npm run dev

build:          ## Production build
	npm run build

start:          ## Start production server
	npm start

# ── Code Quality ─────────────────────────────
lint:           ## Run ESLint
	npm run lint

fix:            ## Auto-fix lint issues
	npm run lint:fix

format:         ## Format all files with Prettier
	npm run format

check:          ## TypeScript + ESLint + Prettier (full check)
	npm run check

# ── Tests ────────────────────────────────────
test:           ## Run tests once
	npm test

tw:             ## Run tests in watch mode
	npm run test:watch

# ── Database ─────────────────────────────────
db-push:        ## Sync schema.prisma → Supabase
	npm run db:push

db-pull:        ## Pull remote DB schema → schema.prisma
	npm run db:pull

db-seed:        ## Seed database with demo data
	npm run db:seed

db-studio:      ## Open Prisma Studio (visual DB browser)
	npm run db:studio

db-generate:    ## Regenerate Prisma client
	npm run db:generate

db-migrate:     ## Create a tracked migration
	npm run db:migrate

db-reset:       ## Reset DB & re-run migrations + seed
	npm run db:reset

# ── Setup ────────────────────────────────────
install:        ## Install dependencies
	npm install

clean:          ## Remove build artifacts
	rm -rf .next node_modules/.cache

# ── Help ─────────────────────────────────────
help:           ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
