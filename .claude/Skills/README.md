# Skills Index

All skills live in `.claude/skills/<name>/SKILL.md` with YAML frontmatter.

---

## Project Skills

| Skill                                       | Invocation                         | Purpose                                                                                  |
| ------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| [ship-phase](ship-phase/SKILL.md)           | `/ship-phase <plan-file> [N]`      | **All-in-one**: implement + quality gate + build check + 7-category audit in one command |
| [implement-group](implement-group/SKILL.md) | `/implement-group <N> <plan-file>` | Implement a plan group with tests, per-file coverage, quality gate, and 7-category audit |
| [verify-group](verify-group/SKILL.md)       | `/verify-group <N> <plan-file>`    | Audit and repair an existing group implementation                                        |
| [write-tests](write-tests/SKILL.md)         | `/write-tests <file>`              | Write tests with correct patterns for the file type                                      |
| [quality-gate](quality-gate/SKILL.md)       | `/quality-gate`                    | Lint, tests, type check — two variants (implementation vs pre-commit)                    |
| [db-change](db-change/SKILL.md)             | `/db-change`                       | Safe schema migration (direct connection, never pooler)                                  |
| [dev](dev/SKILL.md)                         | `/dev`                             | Start dev server                                                                         |
