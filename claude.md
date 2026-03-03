# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Eden Estate RWA (Resident Welfare Association) management application built with Next.js. The app manages resident data, membership forms, financial collections, and community operations for Eden Estate society.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run ESLint (eslint-config-next with core-web-vitals + typescript)
```

No test framework is configured yet.

## Architecture

- **Framework**: Next.js 16 with App Router, React 19, TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 via PostCSS
- **Path alias**: `@/*` maps to `./src/*`
- **Font**: Uses `next/font` with Geist font family

### Directory Structure

```
src/app/             # App Router — pages, layouts, global styles
external_docs/       # RWA reference documents (forms, spreadsheets, requirements)
public/              # Static assets
```

## Code Quality Toolchain

- **ESLint** — core-web-vitals + typescript rulesets (flat config in `eslint.config.mjs`)
- **Prettier** — auto-formatting (config in `.prettierrc`)
- **Husky + lint-staged** — pre-commit hook runs lint + format on staged files only
- **TypeScript** — strict mode enabled, no `any` allowed

```bash
npm run lint         # Run ESLint
npm run format       # Run Prettier
npm run format:check # Check formatting without writing
```

## Core Coding Rules

**All coding standards are defined in [.claude/core_rules.md](.claude/core_rules.md).** This includes:

- Component structure, hooks, and state management patterns
- TypeScript strictness and type conventions
- File/folder organization and naming conventions
- Import ordering, error handling, performance, and styling rules

Read that file before writing or reviewing any code.

## Reference Documents

`external_docs/RWA_Connect_MVP_v1.0.docx` — MVP spec (what to build first, 8-12 weeks).
`external_docs/RWA_Connect_Full_Spec_v3.0.docx` — Full product vision (all phases, worldwide expansion).
`execution_plan/MVP/` — Build-ready MVP plan with phases, tasks, DB schema, and UI wireframes.
`execution_plan/full_spec/` — Complete product roadmap from v3.0 spec (8 phases, 12-18 months).
