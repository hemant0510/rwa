# Skills Index

This folder is a reference map. Actual skill files live where their system requires them.

---

## Project-specific slash commands → `.claude/commands/`

Claude Code auto-discovers these from `.claude/commands/` only — that path is hardcoded and cannot be changed.

| Skill file                                                    | Invocation                         | Purpose                                                                    |
| ------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| [commands/implement-group.md](../commands/implement-group.md) | `/implement-group <N> <plan-file>` | Implement a plan group with tests, quality gate, and 7-category audit      |
| [commands/verify-group.md](../commands/verify-group.md)       | `/verify-group <N> <plan-file>`    | Audit and repair an existing group implementation                          |
| [commands/write-tests.md](../commands/write-tests.md)         | `/write-tests <file>`              | Verbatim test templates for API routes, services, components, pages, hooks |
| [commands/quality-gate.md](../commands/quality-gate.md)       | `/quality-gate`                    | Lint → vitest run → tsc (Variant A: implementation, Variant B: pre-commit) |
| [commands/db-change.md](../commands/db-change.md)             | `/db-change`                       | Safe schema migration (direct connection, never pooler)                    |
| [commands/dev.md](../commands/dev.md)                         | `/dev`                             | Start dev server                                                           |

---

## Global superpowers skills → `~/.claude/plugins/`

These are system-level skills active across ALL projects.

| Skill                                        | Purpose                                  |
| -------------------------------------------- | ---------------------------------------- |
| `superpowers:systematic-debugging`           | Root cause investigation before any fix  |
| `superpowers:test-driven-development`        | Write failing test before implementation |
| `superpowers:verification-before-completion` | Verify work before claiming done         |
| `superpowers:brainstorming`                  | Creative work and feature design         |
| `superpowers:writing-plans`                  | Multi-step task planning                 |
| `superpowers:executing-plans`                | Execute a written plan in a new session  |

---

## Rule

- **Project-specific** (references paths in this repo) → `.claude/commands/`
- **Cross-project** (generic workflow, no repo-specific paths) → `~/.claude/plugins/` (superpowers)
