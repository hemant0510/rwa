# Core Coding Rules

These rules are enforced via ESLint, TypeScript, Prettier, and Git hooks. All code in this project must follow them.

## 1. Component Rules

- **Functional components only** — no class components
- **One component per file** — the file name matches the component name in PascalCase (`UserCard.tsx` exports `UserCard`)
- **Use `export default function`** for page/layout components, **named exports** for shared/reusable components
- **Props via interfaces** — define a `Props` interface (or `ComponentNameProps`) above the component, never use `any`

```tsx
// Good
interface UserCardProps {
  name: string;
  role: "admin" | "member";
}

export function UserCard({ name, role }: UserCardProps) {
  return (
    <div>
      {name} — {role}
    </div>
  );
}
```

## 2. Hooks Rules

- Only call hooks at the **top level** of components or custom hooks — never inside loops, conditions, or nested functions
- **Custom hooks** must start with `use` prefix and live in `src/hooks/` (e.g., `useAuth.ts`)
- Prefer `useCallback` for functions passed as props to child components
- Prefer `useMemo` only for genuinely expensive computations — don't over-memoize

## 3. State Management

- **Local state first** — use `useState`/`useReducer` before reaching for global state
- **Lift state only as high as needed** — not higher
- For shared state across distant components, use React Context with a dedicated provider in `src/providers/`
- Never mutate state directly — always use setter functions or return new objects

## 4. TypeScript Rules

- **`strict: true`** is enabled — do not weaken it
- **No `any`** — use `unknown` if the type is truly unknown, then narrow it
- **No type assertions (`as`)** unless absolutely necessary and commented why
- **Prefer interfaces** for object shapes, **type aliases** for unions/intersections
- All function parameters and return types should be inferable or explicitly typed

## 5. File & Folder Organization

```
src/
├── app/              # Next.js App Router (pages, layouts, route handlers)
│   ├── (routes)/     # Route groups for organizing pages
│   ├── api/          # API route handlers
│   ├── layout.tsx    # Root layout
│   └── globals.css   # Global styles
├── components/       # Reusable UI components
│   ├── ui/           # Primitives (Button, Input, Card, etc.)
│   └── features/     # Feature-specific composed components
├── hooks/            # Custom React hooks
├── lib/              # Utility functions, constants, config
├── providers/        # React Context providers
├── types/            # Shared TypeScript type definitions
└── services/         # API client functions, external service wrappers
```

## 6. Naming Conventions

| Thing            | Convention                                          | Example                  |
| ---------------- | --------------------------------------------------- | ------------------------ |
| Components       | PascalCase                                          | `UserCard.tsx`           |
| Hooks            | camelCase with `use` prefix                         | `useAuth.ts`             |
| Utilities/lib    | camelCase                                           | `formatDate.ts`          |
| Types/Interfaces | PascalCase                                          | `UserProfile`            |
| Constants        | UPPER_SNAKE_CASE                                    | `MAX_RETRY_COUNT`        |
| CSS classes      | Tailwind utilities (no custom CSS unless necessary) | `className="flex gap-4"` |
| Route folders    | kebab-case                                          | `app/user-settings/`     |

## 7. Import Order

Imports should follow this order (enforced by ESLint):

1. React / Next.js built-ins (`react`, `next/...`)
2. Third-party packages
3. Internal aliases (`@/components/...`, `@/lib/...`)
4. Relative imports (`./`, `../`)
5. Type-only imports (`import type { ... }`)

## 8. Error Handling

- Use **error boundaries** (`error.tsx`) at route segment level for UI errors
- API route handlers must return proper status codes and typed error responses
- Never swallow errors silently — log them or surface them to the user
- Use `loading.tsx` and `Suspense` boundaries for async data

## 9. Performance

- Use Next.js `<Image>` component instead of `<img>` — always
- Use `next/link` for internal navigation — never `<a>` for internal routes
- Mark client components with `"use client"` only when needed — keep Server Components as default
- Lazy load heavy components with `dynamic()` from `next/dynamic`

## 10. Styling

- **Tailwind CSS is the primary styling method** — avoid custom CSS files
- Use Tailwind's design tokens for consistency (spacing, colors, typography)
- For complex conditional classes, use `clsx` or `cn` utility
- Support dark mode via Tailwind's `dark:` variant
- Responsive design: mobile-first with `sm:`, `md:`, `lg:` breakpoints

## 11. Security

- Validate all user inputs at the boundary (forms, API routes)
- Use `next/headers` for reading headers/cookies — never trust client-side values on the server
- Sanitize any user-generated content before rendering
- Environment secrets go in `.env.local` only — never hardcode them

## 12. Test Coverage Rules

- **Minimum coverage threshold: 95%** — pre-commit must block if overall coverage drops below 95%
- **New features must have 100% test coverage** — every new file/feature added must be fully tested before commit is allowed
- **If coverage drops on commit**: Claude must automatically generate missing test cases for the new feature before the commit can proceed — do not skip or bypass
- Test naming: `ComponentName.test.tsx` for components, `hookName.test.ts` for hooks, `util.test.ts` for utilities
- Every API route handler must have at least one happy-path and one error-path test
- Vitest is the configured test runner — zero configuration needed
- Test files live in `tests/` mirroring src/ (no underscores — NOT `__tests__/`)
- Run one file: `npx vitest run tests/path/to/file.test.ts`
- API route tests MUST use `vi.hoisted()` — see `/write-tests` for verbatim pattern
- Always `import { mockPrisma } from "../__mocks__/prisma"` — never declare inline
- Always `import { mockStorageBucket, mockSupabaseAdmin } from "../__mocks__/supabase"` for storage tests
- `$transaction` is already in the shared mock — do not add it to new model entries

## 13. Database Rules

- **NEVER use `npm run db:push` or `npm run db:migrate`** — they use the pooler (port 6543) which times out on DDL. Use `/db-change` for the correct direct-connection sequence.
- **Master/platform data belongs in `supabase/seed-master.ts`** — this includes: SuperAdmin accounts, platform plans (`PlatformPlan`), billing options (`PlanBillingOption`), and any other platform-wide lookup/config tables
- **`supabase/seed.ts`** is for dev/demo data only (sample societies, residents, fees) — never put platform master data here
- **Never hardcode SuperAdmin credentials or IDs in application code** — they must come from `seed-master.ts` or environment variables
- All schema changes require a Prisma migration (`npm run db:migrate`) — never edit the DB directly
- Migration files are committed alongside schema changes — never squash or delete migration history
- `supabase/seed-master.ts` must use `upsert` (not `create`) so it is safe to re-run on any environment without duplicating records
- When adding a new master/lookup table (e.g. categories, roles, plan types), seed data for it goes in `seed-master.ts`
- Society-specific or resident-specific data is never seeded in `seed-master.ts` — it is created through app flows or `seed.ts`
- Always run `npx prisma generate` after schema changes before writing application code that uses new models
- **NEVER add new seed data to `seed.ts` or `seed-master.ts` without explicit user approval** — always ask first, describe what data you intend to add and why, and wait for confirmation before writing it
