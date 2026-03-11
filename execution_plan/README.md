# RWA Connect — Execution Plans

## Structure

```
execution_plan/
├── MVP/              ← Build-ready plan from RWA_Connect_MVP_v1.0.docx (8-12 weeks)
│   ├── README.md
│   ├── database-design.md
│   ├── phase-0-setup.md
│   ├── phase-1-super-admin.md
│   ├── phase-2-registration.md
│   ├── phase-3-fees.md
│   ├── phase-4-expenses.md
│   ├── phase-5-notifications.md
│   ├── phase-6-migration-reports.md
│   └── phase-7-security-launch.md
│
└── full_spec/        ← Full product roadmap from RWA_Connect_Full_Spec_v3.0.docx (12-18 months)
    ├── README.md
    ├── database-design.md
    ├── enums-reference.md
    ├── phase-1-foundation.md
    ├── phase-2-core.md
    ├── phase-3-financial.md
    ├── phase-4-elections.md
    ├── phase-5-notifications.md
    ├── phase-6-mobile-payments.md
    ├── phase-7-community.md
    └── phase-8-enterprise.md
```

~

## Source Documents

| Plan      | Source Document                                 | Status |
| --------- | ----------------------------------------------- | ------ |
| MVP       | `external_docs/RWA_Connect_MVP_v1.0.docx`       | Ready  |
| Full Spec | `external_docs/RWA_Connect_Full_Spec_v3.0.docx` | Ready  |

## Build Order

**MVP first → ship → then Phase 3+ features progressively.**

The MVP (`execution_plan/MVP/`) covers Phases 1-2 of the full product plan. Once shipped, the `full_spec/` phases 3-8 extend the platform with festivals, elections, mobile app, payment gateway, community features, and global expansion.
