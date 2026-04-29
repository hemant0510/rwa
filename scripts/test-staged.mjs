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

import {
  coverageExclude,
  coverageGateExclude,
  coverageInclude,
} from "../vitest.coverage-policy.mjs";

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
  /^next\.config\.(ts|js)$/, // Next.js config — no testable runtime logic
  /\/sw\.(ts|tsx)$/, // Service workers — use ServiceWorkerGlobalScope APIs unavailable in jsdom
  /^scripts\//, // dev/build scripts — not app runtime code
  /^supabase\//, // seed and schema files — exercised by integration only
];

// Convert the project's coverage include/exclude globs into a matcher.
// A staged file must match at least one include pattern AND no exclude
// pattern to be coverage-checked. This keeps the pre-commit gate aligned
// with the project's full-suite coverage policy in vitest.config.ts so
// neither config drifts from the other.
function globToRegExp(glob) {
  // Escape regex special chars except `*` and `?`. We intentionally keep
  // `()[]` literal because Next.js route groups use them.
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (/[.+^${}|\\]/.test(c)) {
      re += "\\" + c;
    } else if (c === "(" || c === ")" || c === "[" || c === "]") {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$");
}

const includeRegexes = coverageInclude.map(globToRegExp);
const excludeRegexes = coverageExclude.map(globToRegExp);
const gateExcludeSet = new Set(coverageGateExclude);

function isInCoverageScope(file) {
  if (excludeRegexes.some((re) => re.test(file))) return false;
  if (gateExcludeSet.has(file)) return false;
  return includeRegexes.some((re) => re.test(file));
}

const coverableFiles = sourceFiles.filter(
  (f) => !SKIP_COVERAGE.some((pat) => pat.test(f)) && isInCoverageScope(f),
);

// ── 4. Print what we're doing ────────────────────────────────────────────────
console.log(`\n[test-staged] ${staged.length} staged TS file(s):`);
staged.forEach((f) => console.log(`  • ${f}`));

const skippedSourceFiles = sourceFiles.filter((f) => !coverableFiles.includes(f));
if (skippedSourceFiles.length > 0) {
  console.log(
    `\n[test-staged] Coverage SKIPPED for ${skippedSourceFiles.length} file(s) (outside vitest.coverage-policy.mjs scope):`,
  );
  skippedSourceFiles.forEach((f) => console.log(`  • ${f}`));
}

if (coverableFiles.length > 0) {
  console.log(`\n[test-staged] Coverage will be checked for:`);
  coverableFiles.forEach((f) => console.log(`  • ${f}`));
} else {
  console.log("\n[test-staged] No coverable source files staged — running related tests only.");
}
console.log();

// ── 5. Build vitest CLI args, batching to stay under Windows cmd.exe limit ───
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
// Windows cmd.exe caps the command line at ~8191 chars. Large commits (e.g.
// 100+ staged files) blow past that with file paths + per-file coverage
// includes. We split into batches so each invocation stays well under the
// limit. Each batch runs independently with its own per-file coverage
// thresholds — the result is the same as one big run.
//
// Vitest coverage.include uses minimatch, where `(` and `)` are special.
// Next.js route groups like `(authed)` would otherwise silently fail to
// match the staged source file, skipping the per-file threshold check.
const escapeGlob = (p) => p.replace(/[()[\]{}!?*+@]/g, "\\$&");

const SAFE_CMD_LIMIT = 6000; // leave headroom under 8191 for shell expansion

function buildArgs(batchStaged, batchCoverable) {
  const a = ["vitest", "related", ...batchStaged, "--run", "--reporter=verbose"];
  if (batchCoverable.length > 0) {
    a.push(
      "--coverage",
      "--coverage.provider=v8",
      "--coverage.reporter=text",
      ...batchCoverable.flatMap((f) => ["--coverage.include", escapeGlob(f)]),
      "--coverage.thresholds.perFile=true",
      "--coverage.thresholds.lines=95",
      "--coverage.thresholds.branches=95",
      "--coverage.thresholds.functions=95",
      "--coverage.thresholds.statements=95",
    );
  }
  return a;
}

function argsLength(a) {
  return a.reduce((sum, x) => sum + x.length + 1, 0);
}

const coverableSet = new Set(coverableFiles);
const batches = [];
let currentBatch = [];

for (const file of staged) {
  const trial = [...currentBatch, file];
  const trialCoverable = trial.filter((f) => coverableSet.has(f));
  if (currentBatch.length > 0 && argsLength(buildArgs(trial, trialCoverable)) > SAFE_CMD_LIMIT) {
    batches.push(currentBatch);
    currentBatch = [file];
  } else {
    currentBatch = trial;
  }
}
if (currentBatch.length > 0) batches.push(currentBatch);

if (batches.length > 1) {
  console.log(
    `[test-staged] Splitting into ${batches.length} batches to stay under Windows cmd.exe limit.\n`,
  );
}

// ── 6. Run vitest (one invocation per batch) ─────────────────────────────────
let exitCode = 0;
for (let i = 0; i < batches.length; i++) {
  const batch = batches[i];
  const batchCoverable = batch.filter((f) => coverableSet.has(f));
  if (batches.length > 1) {
    console.log(`\n[test-staged] Batch ${i + 1}/${batches.length} — ${batch.length} file(s)`);
  }
  const result = spawnSync("npx", buildArgs(batch, batchCoverable), {
    stdio: "inherit",
    // shell:true is required on Windows for `npx` to resolve correctly
    shell: process.platform === "win32",
    cwd: process.cwd(),
  });
  if (result.status !== 0) exitCode = result.status ?? 1;
}

process.exit(exitCode);
