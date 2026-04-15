# Project Memory Index

Long-lived, repo-scoped notes that survive across sessions and sync to any machine via git. Anything written here is authoritative for future sessions working on this codebase.

| File                                                                   | Type    | Description                                                                                                                        |
| ---------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [project_counsellor_groups.md](project_counsellor_groups.md)           | project | Counsellor role plan — 8 groups, Group 1 shipped; schema blocker decisions and deferred-to-later-group items                       |
| [project_supabase_connection.md](project_supabase_connection.md)       | project | Direct URL is IPv6-only on this network — use session-mode pooler (port 5432) for DDL                                              |
| [project_super_admin_visibility.md](project_super_admin_visibility.md) | project | Super Admin = GOD: every admin GET must use `getAdminContext`; writes stay RWA-scoped; no SA read blackouts without spec exception |
