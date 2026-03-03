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

`external_docs/RWA_Connect_Requirements_v2.0.docx` contains the full product requirements. Consult this when implementing new features.
