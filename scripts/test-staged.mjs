#!/usr/bin/env node
/**
 * test-staged.mjs
 *
 * Pre-commit test runner. Instead of running all 4000+ tests on every commit,
 * this script:
 *
 *   1. Reads ONLY the staged TS/TSX files from git
 *   2. Runs `vitest related <files>` — Vitest uses its module graph to find
 *      exactly which test files exercise the staged code (no manual mapping needed)
 *   3. Scopes coverage instrumentation to ONLY the staged source files
 *      (`--coverage.include=<file>` per file)
 *   4. Enforces 95% coverage PER FILE (`--coverage.thresholds.perFile=true`)
 *
 * This means:
 *   - Untouched files with existing coverage are never re-checked
 *   - Coverage only fails for the files YOU changed
 *   - Commit time goes from ~3 min → ~10–20 sec for typical changes
 */

import { execSync, spawnSync } from "child_process";
import process from "process";

// ── 1. Get staged TS/TSX files ───────────────────────────────────────────────
// --diff-filter=ACMR: Added, Copied, Modified, Renamed (skip Deleted)
let staged;
try {
  staged = execSync("git diff --cached --name-only --diff-filter=ACMR", {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .map((f) => f.trim().replace(/\\/g, "/")) // normalise Windows backslashes
    .filter((f) => f && /\.(ts|tsx)$/.test(f) && !f.endsWith(".d.ts"));
} catch {
  // Not inside a git repo or git unavailable — skip silently
  process.exit(0);
}

if (staged.length === 0) {
  console.log("[test-staged] No staged TS/TSX files — skipping tests.");
  process.exit(0);
}

// ── 2. Separate test files from source files ─────────────────────────────────
const isTestFile = (f) => /\.(test|spec)\.(ts|tsx)$/.test(f);
const sourceFiles = staged.filter((f) => !isTestFile(f));

// ── 3. Determine which source files to coverage-check ────────────────────────
// Skip files with no meaningful executable code — they would always show 0%
// and block commits for the wrong reason.
const SKIP_COVERAGE = [
  /^src\/types\//, // pure TypeScript type files
  /layout\.(tsx|ts)$/, // Next.js layout wrappers
  /loading\.(tsx|ts)$/, // Next.js loading skeletons
  /error\.(tsx|ts)$/, // Next.js error boundaries
  /not-found\.(tsx|ts)$/, // Next.js 404 pages
  /^src\/lib\/prisma\.ts$/, // Prisma client singleton
  /^src\/lib\/supabase\//, // Supabase client helpers
  /^src\/lib\/whatsapp\.ts$/, // External messaging client
];

const coverableFiles = sourceFiles.filter((f) => !SKIP_COVERAGE.some((pat) => pat.test(f)));

// ── 4. Print what we're doing ────────────────────────────────────────────────
console.log(`\n[test-staged] ${staged.length} staged TS file(s):`);
staged.forEach((f) => console.log(`  • ${f}`));

if (coverableFiles.length > 0) {
  console.log(`\n[test-staged] Coverage will be checked for:`);
  coverableFiles.forEach((f) => console.log(`  • ${f}`));
} else {
  console.log("\n[test-staged] No coverable source files staged — running related tests only.");
}
console.log();

// ── 5. Build vitest CLI args ─────────────────────────────────────────────────
//
// `vitest related <files>` finds test files that import the staged files by
// walking Vite's module graph. This correctly handles:
//   - Direct static imports
//   - vi.mock() calls (Vitest hoists and resolves these as dependencies)
//   - Re-exports through barrel files
//
// We pass BOTH test files and source files so:
//   - Staged test files run directly
//   - Staged source files trigger their importing test files
//
const args = ["vitest", "related", ...staged, "--run", "--reporter=verbose"];

if (coverableFiles.length > 0) {
  args.push(
    "--coverage",
    "--coverage.provider=v8",
    "--coverage.reporter=text",
    // Instrument ONLY the staged source files — everything else is invisible
    // to coverage. This is the key to making per-file thresholds meaningful.
    ...coverableFiles.flatMap((f) => ["--coverage.include", f]),
    // Each staged file must individually reach 95%. A new file with zero tests
    // will fail here, forcing the developer to write tests before committing.
    "--coverage.thresholds.perFile=true",
    "--coverage.thresholds.lines=95",
    "--coverage.thresholds.branches=95",
    "--coverage.thresholds.functions=95",
    "--coverage.thresholds.statements=95",
  );
}

// ── 6. Run vitest ─────────────────────────────────────────────────────────────
const result = spawnSync("npx", args, {
  stdio: "inherit",
  // shell:true is required on Windows for `npx` to resolve correctly
  shell: process.platform === "win32",
  cwd: process.cwd(),
});

process.exit(result.status ?? 0);
