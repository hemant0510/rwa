# Project Guidelines

## Code Style

- This is a Next.js project using TypeScript (`.tsx`, `.ts`).
- Follow the default `eslint`/`prettier` configuration in the repo (`eslint.config.mjs`, `tsconfig.json`).
- Keep formatting consistent with `app/` directory examples such as `layout.tsx` and `page.tsx`.
- Use functional React components and hooks; prefer `export default function` syntax.

## Architecture

- Built on Next.js 13+ App Router using the `app/` directory.
- Pages and layouts live under `src/app/` with a root `layout.tsx` and individual `page.tsx` files.
- Global styles in `src/app/globals.css`.
- No custom server code; purely frontend.

## Build and Test

- Install dependencies with `npm install` (or `yarn`, `pnpm`, `bun`).
- Development server: `npm run dev`.
- Build: `npm run build`.
- Start production: `npm start`.
- There are currently no tests configured, so agents should not expect test scripts unless added later.

## Project Conventions

- Use the `next/font` API as shown in the template for font optimization.
- Update `app/page.tsx` for content; components may be added to `src/components/` if created.
- Keep the root structure minimal; additional directories should align with standard Next.js conventions.

## Integration Points

- The project may deploy to Vercel; no additional backend services are present.
- External docs under `external_docs/` can be referenced for design or implementation details.

## Security

- Sensitive information should not be committed. Use environment variables via `.env.local` when needed.

> This file is intended to help Copilot Chat and other AI agents understand and contribute to the repository efficiently. Agents should merge with any existing instructions if encountered before writing new ones.
