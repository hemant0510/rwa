# RWA Connect — Eden Estate

Resident Welfare Association management platform built with Next.js 16, React 19, TypeScript, Tailwind CSS, Prisma 7, and Supabase.

## Quick Start

```bash
npm install          # Install dependencies
cp .env.example .env # Configure environment variables
npm run db:generate  # Generate Prisma client
npm run dev          # Start dev server → http://localhost:3000
```

## Commands

All commands are available via `npm run <script>` or `make <target>`.

### Dev & Build

| npm script      | make shortcut | Description                                          |
| --------------- | ------------- | ---------------------------------------------------- |
| `npm run dev`   | `make dev`    | Start dev server                                     |
| `npm run build` | `make build`  | Production build (generates Prisma client + Next.js) |
| `npm start`     | `make start`  | Start production server                              |

### Code Quality

| npm script             | make shortcut | Description                                |
| ---------------------- | ------------- | ------------------------------------------ |
| `npm run lint`         | `make lint`   | Run ESLint                                 |
| `npm run lint:fix`     | `make fix`    | Auto-fix lint issues                       |
| `npm run format`       | `make format` | Format all files with Prettier             |
| `npm run format:check` | —             | Check formatting without writing           |
| `npm run check`        | `make check`  | Full check: TypeScript + ESLint + Prettier |

### Tests

| npm script           | make shortcut | Description             |
| -------------------- | ------------- | ----------------------- |
| `npm test`           | `make test`   | Run tests once          |
| `npm run test:watch` | `make tw`     | Run tests in watch mode |

### Database

Schema is managed via `prisma/dbinuse.prisma` (configured in `prisma.config.ts`).

| npm script                  | make shortcut            | Description                                 |
| --------------------------- | ------------------------ | ------------------------------------------- |
| `npm run db:push`           | `make db-push`           | Sync schema → Supabase DB                   |
| `npm run db:pull`           | `make db-pull`           | Pull remote DB schema → local               |
| `npm run db:generate`       | `make db-generate`       | Regenerate Prisma client                    |
| `npm run db:studio`         | `make db-studio`         | Open Prisma Studio (visual DB browser)      |
| `npm run db:migrate`        | `make db-migrate`        | Create a new tracked migration (dev)        |
| `npm run db:migrate:deploy` | `make db-migrate-deploy` | Apply pending migrations (production)       |
| `npm run db:reset`          | `make db-reset`          | Reset DB & re-run all migrations + seed     |
| `npm run db:seed`           | `make db-seed`           | Seed database (default)                     |
| `npm run db:seed:master`    | `make db-seed-master`    | Seed master data only (SuperAdmin + plans)  |
| `npm run db:seed:dev`       | `make db-seed-dev`       | Seed full demo data (societies + residents) |

### Utility

| make shortcut  | Description                     |
| -------------- | ------------------------------- |
| `make install` | Install dependencies            |
| `make clean`   | Remove build artifacts          |
| `make help`    | Show all available make targets |

## Project Structure

```
src/app/             # App Router — pages, layouts, API routes
prisma/
  ├── dbinuse.prisma # Active schema (25 tables)
  ├── schema.prisma  # Full schema backup (34 tables, frozen)
  ├── seed.ts        # Demo data seed (societies + residents)
  └── seed-master.ts # Master data seed (SuperAdmin + plans only)
prisma.config.ts     # Prisma 7 config (schema path + DB connection)
execution_plan/      # Build plans, DB docs, and architecture
external_docs/       # RWA reference documents
public/              # Static assets
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials. See `.env.example` for all required variables.

## Documentation

- [CLAUDE.md](CLAUDE.md) — Coding standards and project rules
- [execution_plan/DB/database-management.md](execution_plan/DB/database-management.md) — DB management, backups, and deployment pipeline
- [execution_plan/MVP/](execution_plan/MVP/) — MVP build plan and phases
- [execution_plan/full_spec/](execution_plan/full_spec/) — Full product roadmap
