# Full Spec Phase 5 — Notifications Advanced

**Duration**: ~2 weeks
**Goal**: Per-RWA WhatsApp numbers, push notifications via Firebase, email channel, notification centre in resident portal, advanced broadcast features.
**Depends on**: Phase 2 (Core MVP — basic notifications already working)

---

## What Phase 2 Already Built

Phase 2 delivered:

- WhatsApp Business API via WATI BSP (platform-level single account)
- 7 core message templates (registration, payment, broadcast, etc.)
- Automated triggers for core events
- WhatsApp → SMS fallback chain
- Bulk broadcast composer
- Basic delivery tracking

Phase 5 **extends** this with per-RWA WhatsApp, push notifications, email, notification centre, and advanced broadcast features.

---

## Task 5.1 — Per-RWA WhatsApp Numbers

### Overview

Allow societies on Standard/Premium/Enterprise plans to register their own WhatsApp Business number instead of using the platform-level account. This gives them their own sender identity.

### Implementation

**Society Settings — WhatsApp Configuration**

```
┌─────────────────────────────────────────────────────────┐
│  Settings → WhatsApp Configuration                       │
│─────────────────────────────────────────────────────────│
│                                                          │
│  Current Sender: Platform Default (RWA Connect)          │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  ☐ Use own WhatsApp Business number              │    │
│  │                                                   │    │
│  │  Phone Number:  [+91 98765 43210         ]       │    │
│  │  Phone ID:      [________________________]       │    │
│  │  API Key:       [________________________]       │    │
│  │  Template NS:   [________________________]       │    │
│  │                                                   │    │
│  │  Status: ● Connected  |  Last tested: 2 min ago  │    │
│  │                                                   │    │
│  │  [Test Connection]          [Save Configuration]  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Note: Requires WhatsApp Business Account verified       │
│  by Meta. Contact support for setup assistance.          │
└─────────────────────────────────────────────────────────┘
```

### Database

Already exists in `societies` table:

- `whatsapp_enabled` (BOOLEAN)
- `whatsapp_phone_id` (VARCHAR)
- `whatsapp_api_key` (VARCHAR — encrypted at rest)
- `whatsapp_template_namespace` (VARCHAR)

### Notification Sending Logic

```
Send notification:
  1. Check society.whatsapp_enabled
  2. If TRUE → use society's WATI credentials
  3. If FALSE → use platform-level WATI credentials
  4. On failure → retry 3x → fallback to SMS → fallback to Push
```

### Template Management

- Per-RWA accounts need their own Meta-approved templates
- Template sync: check template approval status daily via WATI API
- Admin can view template approval status in settings

### API Endpoints

| Method | Endpoint                                     | Description            |
| ------ | -------------------------------------------- | ---------------------- |
| GET    | `/api/v1/societies/:id/whatsapp-config`      | Get current config     |
| PUT    | `/api/v1/societies/:id/whatsapp-config`      | Update config          |
| POST   | `/api/v1/societies/:id/whatsapp-config/test` | Test connection        |
| GET    | `/api/v1/societies/:id/whatsapp-templates`   | List template statuses |

**Acceptance**: Society can configure own WhatsApp number. Messages send from RWA's number when configured. Fallback to platform account works. Test connection validates credentials.

---

## Task 5.2 — Extended Notification Triggers

Phase 2 covered 7 core triggers. This phase adds 7+ more for the full 14+ triggers.

### Complete Trigger List

| #   | Event                          | Recipient        | Channel        | Template Key            | Phase |
| --- | ------------------------------ | ---------------- | -------------- | ----------------------- | ----- |
| 1   | Registration submitted         | Admin(s)         | WhatsApp       | `registration_new`      | 2     |
| 2   | Registration approved          | Resident         | WhatsApp       | `registration_approved` | 2     |
| 3   | Registration rejected          | Resident         | WhatsApp       | `registration_rejected` | 2     |
| 4   | Payment received               | Resident         | WhatsApp       | `payment_receipt`       | 2     |
| 5   | Fee overdue                    | Resident         | WhatsApp       | `fee_overdue`           | 2     |
| 6   | RWAID card ready               | Resident         | WhatsApp       | `rwaid_ready`           | 2     |
| 7   | Broadcast message              | Filtered list    | WhatsApp       | `broadcast_custom`      | 2     |
| 8   | Admin term expiry (90d)        | Admin            | WhatsApp+Push  | `term_expiry_90d`       | **5** |
| 9   | Admin term expiry (60d)        | Admin            | WhatsApp+Push  | `term_expiry_60d`       | **5** |
| 10  | Admin term expiry (30d)        | Admin+Super      | WhatsApp+Push  | `term_expiry_30d`       | **5** |
| 11  | Festival fund created          | All residents    | WhatsApp       | `festival_created`      | **5** |
| 12  | Festival contribution reminder | Non-contributors | WhatsApp       | `festival_reminder`     | **5** |
| 13  | Festival settlement report     | All contributors | WhatsApp+Email | `festival_settled`      | **5** |
| 14  | Property transfer initiated    | Old+New owner    | WhatsApp       | `property_transfer`     | **5** |
| 15  | Expense query update           | Querier          | Push           | `expense_query_update`  | **5** |
| 16  | Election transition            | All residents    | WhatsApp       | `election_transition`   | **5** |
| 17  | Subscription renewal due       | Admin            | WhatsApp+Email | `subscription_renewal`  | **5** |
| 18  | System maintenance             | All admins       | Push+Email     | `system_maintenance`    | **5** |

### New Template Designs

**`term_expiry_30d`**:

```
Dear {{admin_name}},

Your term as {{position}} of {{society_name}} expires on {{expiry_date}} — only 30 days remaining.

Please coordinate with your committee for election/transition planning.

— RWA Connect
```

**`festival_created`**:

```
🎉 {{society_name}} — New Festival Fund

{{festival_name}} collection is now open!
📅 Event date: {{event_date}}
💰 Target: ₹{{target_amount}}
📅 Collection period: {{start_date}} to {{end_date}}

Contribute via your admin or the RWA Connect portal.
```

**`festival_settled`**:

```
{{society_name}} — {{festival_name}} Settlement

Total collected: ₹{{total_collected}}
Total spent: ₹{{total_spent}}
{{surplus_or_deficit}}: ₹{{amount}}

Settlement: {{disposal_method}}
View full report: {{report_url}}
```

### Cron Job for Scheduled Triggers

```typescript
// src/lib/cron/notification-scheduler.ts
// Runs daily at 9:00 AM IST

async function runDailyNotifications() {
  await checkAdminTermExpiry(); // 90/60/30 day reminders
  await checkFeeOverdue(); // Past grace period
  await checkFestivalReminders(); // 3 days before collection ends
  await checkSubscriptionRenewal(); // 30/15/7 days before expiry
}
```

**Acceptance**: All 14+ triggers fire correctly. New templates submitted to Meta and approved. Cron job runs daily. Each trigger sends to correct recipients via correct channel.

---

## Task 5.3 — Push Notifications (Firebase FCM)

### Setup

1. Create Firebase project
2. Configure Firebase Admin SDK (server-side)
3. Add Firebase client SDK for service worker
4. Store FCM tokens in `users.fcm_token`

### Service Worker

```
public/firebase-messaging-sw.js
  - Handles background push notifications
  - Shows notification with title, body, icon
  - Click handler opens relevant page
```

### FCM Token Lifecycle

```
User opens app
  → Request notification permission
  → If granted: get FCM token → save to users.fcm_token
  → If denied: skip push, rely on WhatsApp/SMS
  → On token refresh: update users.fcm_token

User logs out
  → Delete FCM token from server
```

### Push Notification Payload

```json
{
  "notification": {
    "title": "Payment Received",
    "body": "₹12,000 payment recorded for session 2025-26",
    "icon": "/icons/icon-192.png",
    "badge": "/icons/badge-72.png"
  },
  "data": {
    "type": "PAYMENT_RECEIPT",
    "action_url": "/payments/abc123",
    "notification_id": "uuid"
  }
}
```

### Fallback Chain (Full)

```
WhatsApp (primary)
  → Wait 60s for delivery confirmation
  → If FAILED: SMS (secondary)
    → Wait 60s for delivery
    → If FAILED: Push (tertiary)
      → If no FCM token: Email (quaternary)
        → If no email: Mark as FAILED, log
```

### Permission Request UI

```
┌──────────────────────────────────┐
│                                  │
│  🔔 Enable Notifications?       │
│                                  │
│  Get instant updates on:        │
│  • Payment confirmations        │
│  • Fee reminders                │
│  • Festival updates             │
│  • Society announcements        │
│                                  │
│  [Enable]        [Not Now]      │
│                                  │
└──────────────────────────────────┘
```

Shown once after first login. "Not Now" dismisses for 7 days, then asks again.

**Acceptance**: Push notifications work on Chrome, Edge, Firefox. FCM token management reliable. Permission prompt shows once. Background notifications display correctly.

---

## Task 5.4 — Email Channel

### Setup

- Provider: SendGrid (or SMTP fallback)
- Used for: Receipts, reports, monthly summaries, subscription renewals
- NOT the primary channel — supplements WhatsApp/SMS/Push

### Email Templates

| Template               | When                  | Content                             |
| ---------------------- | --------------------- | ----------------------------------- |
| `receipt_email`        | Payment recorded      | Payment details + PDF attachment    |
| `monthly_summary`      | 1st of each month     | Collection stats, expense breakdown |
| `festival_report`      | Festival settled      | Full settlement report              |
| `subscription_renewal` | 30d before expiry     | Renewal reminder with payment link  |
| `welcome`              | Registration approved | Welcome + RWAID + portal link       |

### HTML Email Template Structure

```
src/lib/email/
├── templates/
│   ├── receipt.tsx         # React Email component
│   ├── monthly-summary.tsx
│   ├── festival-report.tsx
│   ├── subscription.tsx
│   └── welcome.tsx
├── send.ts                 # SendGrid API wrapper
└── config.ts               # API keys, from address
```

### Unsubscribe Management

- Every email includes unsubscribe link
- Unsubscribe updates `users.notify_email = false`
- One-click unsubscribe via List-Unsubscribe header
- Mandatory emails (subscription alerts) cannot be unsubscribed

### API Endpoints

| Method | Endpoint                              | Description              |
| ------ | ------------------------------------- | ------------------------ |
| POST   | `/api/v1/notifications/email/send`    | Send email notification  |
| GET    | `/api/v1/users/:id/email-preferences` | Get email preferences    |
| PUT    | `/api/v1/users/:id/email-preferences` | Update email preferences |
| POST   | `/api/v1/email/unsubscribe/:token`    | Process unsubscribe      |

**Acceptance**: Emails deliver to inbox (not spam). HTML renders correctly on Gmail, Outlook, Apple Mail. Unsubscribe works. PDF attachments send with receipts.

---

## Task 5.5 — Notification Centre (Resident Portal)

### UI

```
┌──────────────────────────────────┐
│  Notifications            [All ▾]│
│──────────────────────────────────│
│                                  │
│  Today                           │
│  ┌────────────────────────────┐  │
│  │ 💰 Payment Confirmed      │  │
│  │ ₹12,000 received for      │  │
│  │ session 2025-26            │  │
│  │ 2 hours ago                │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ 🎉 Diwali Fund Open       │  │
│  │ Collection period: Oct 15  │  │
│  │ to Nov 5. Target: ₹50,000 │  │
│  │ 5 hours ago                │  │
│  └────────────────────────────┘  │
│                                  │
│  Yesterday                       │
│  ┌────────────────────────────┐  │
│  │ ● Fee Reminder             │  │
│  │ Annual fee ₹12,000 due by  │  │
│  │ April 30, 2025             │  │
│  │ Yesterday at 9:00 AM       │  │
│  └────────────────────────────┘  │
│                                  │
│  [Mark all as read]              │
│  Showing last 90 days            │
│──────────────────────────────────│
│  🏠    💰    📋    🎉    👤     │
└──────────────────────────────────┘
```

### Features

- **Grouped by date**: Today, Yesterday, This Week, Earlier
- **Category filter**: All, Fees, Festivals, Admin, System
- **Unread indicator**: Blue dot on unread items, bold title
- **Mark all as read**: Bulk action
- **Click-through**: Tapping notification opens relevant page
- **Empty state**: "No notifications yet" with illustration
- **Pagination**: Load more on scroll (50 per page)
- **Real-time**: New notifications appear instantly via Supabase Realtime

### Real-time Updates

```typescript
// Subscribe to new notifications
supabase
  .channel("notifications")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "notifications",
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      // Add to notification list
      // Increment badge count
      // Show toast
    },
  )
  .subscribe();
```

### Components

| Component            | Description                                      |
| -------------------- | ------------------------------------------------ |
| `NotificationList`   | Grouped list with date headers                   |
| `NotificationItem`   | Single notification with icon, title, body, time |
| `NotificationBadge`  | Red badge on bell icon (unread count)            |
| `NotificationFilter` | Category dropdown filter                         |

### API Endpoints

| Method | Endpoint                             | Description                    |
| ------ | ------------------------------------ | ------------------------------ |
| GET    | `/api/v1/notifications`              | List with pagination + filters |
| PUT    | `/api/v1/notifications/:id/read`     | Mark single as read            |
| PUT    | `/api/v1/notifications/read-all`     | Mark all as read               |
| GET    | `/api/v1/notifications/unread-count` | Badge count                    |

**Acceptance**: Notifications load in < 500ms. Real-time updates work. Category filter works. Unread count accurate. Click-through navigates correctly. Last 90 days shown.

---

## Task 5.6 — Notification Preferences

### Resident Preference Screen

```
┌──────────────────────────────────┐
│  Notification Preferences         │
│──────────────────────────────────│
│                                  │
│  Channels                        │
│  ┌────────────────────────────┐  │
│  │ WhatsApp        [━━━━━ ON]│  │
│  │ SMS             [━━━━━ ON]│  │
│  │ Push            [━━ OFF━━]│  │
│  │ Email           [━━ OFF━━]│  │
│  └────────────────────────────┘  │
│                                  │
│  Notification Types              │
│  ┌────────────────────────────┐  │
│  │ Fee reminders       [ON]  🔒│  │
│  │ Payment receipts    [ON]  🔒│  │
│  │ Registration status [ON]  🔒│  │
│  │ Festival updates    [ON]   │  │
│  │ Society broadcasts  [ON]   │  │
│  │ Election notices    [ON]   │  │
│  │ Expense updates     [OFF]  │  │
│  └────────────────────────────┘  │
│                                  │
│  🔒 = Mandatory, cannot disable  │
│                                  │
│  [Save Preferences]              │
│──────────────────────────────────│
│  🏠    💰    📋    🎉    👤     │
└──────────────────────────────────┘
```

### Mandatory vs Optional

**Mandatory (cannot opt out)**:

- Fee overdue reminders
- Payment receipts
- Registration status changes
- Admin term expiry (for admins)
- Subscription alerts

**Optional (user can disable)**:

- Festival fund updates
- Society broadcasts
- Election notices
- Expense query updates
- Monthly summaries

### Database

Preferences stored in `users` table:

- `notify_whatsapp` (BOOLEAN, default TRUE)
- `notify_sms` (BOOLEAN, default TRUE)
- `notify_push` (BOOLEAN, default FALSE)
- `notify_email` (BOOLEAN, default FALSE)

Type-level preferences stored in `notification_preferences` table (if built in Phase 1 schema) or as JSONB on users.

### API Endpoints

| Method | Endpoint                                     | Description        |
| ------ | -------------------------------------------- | ------------------ |
| GET    | `/api/v1/users/:id/notification-preferences` | Get preferences    |
| PUT    | `/api/v1/users/:id/notification-preferences` | Update preferences |

**Acceptance**: All preferences save and apply. Mandatory notifications always send regardless of preferences. Channel toggles respected. Push toggle triggers FCM token registration/deletion.

---

## Task 5.7 — Advanced Broadcast Features

### Scheduled Broadcasts

```
┌─────────────────────────────────────────────────────────┐
│  Compose Broadcast                                       │
│─────────────────────────────────────────────────────────│
│                                                          │
│  Message:                                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Dear {Name},                                      │   │
│  │                                                    │   │
│  │ This is a reminder that your annual fee of         │   │
│  │ ₹{Amount} for session {Session} is due by         │   │
│  │ {DueDate}. Please pay at the earliest.            │   │
│  │                                                    │   │
│  │ Thank you,                                         │   │
│  │ {SocietyName} Management                          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Insert variable: [{Name}] [{Amount}] [{DueDate}]       │
│                   [{Session}] [{HouseNo}] [{RWAID}]      │
│                                                          │
│  Recipients: [Fee Overdue ▾]        42 recipients        │
│  Channel:    [WhatsApp ▾]                                │
│                                                          │
│  Send:  ● Now  ○ Schedule                                │
│                                                          │
│  ┌── Schedule ──────────────────────────────────────┐   │
│  │  Date: [Mar 15, 2026    ]  Time: [09:00 AM    ]  │   │
│  │  ☐ Repeat monthly on this date                    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [Preview (5 samples)]                [Send / Schedule]  │
└─────────────────────────────────────────────────────────┘
```

### Recipient Filtering (Enhanced)

| Filter      | Options                                                     |
| ----------- | ----------------------------------------------------------- |
| Status      | All Active, Fee Pending, Fee Overdue, Fee Partial, Fee Paid |
| Ownership   | Owner, Owner NRO, Joint Owner, Tenant                       |
| Block/Tower | Per society type — dropdown of all towers/blocks            |
| Floor       | Specific floor(s)                                           |
| Festival    | Non-contributors for a specific festival                    |
| Custom      | Manual selection from resident list                         |

### Broadcast Analytics

```
┌─────────────────────────────────────────────────────────┐
│  Broadcast History                                       │
│─────────────────────────────────────────────────────────│
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Date       │ Message Preview    │ Recipients │ Stats│ │
│  │────────────│────────────────────│────────────│──────│ │
│  │ Mar 4      │ Dear {Name}, This  │ 42         │ ✓ 40│ │
│  │ 09:00 AM   │ is a reminder...   │            │ ✗ 2 │ │
│  │────────────│────────────────────│────────────│──────│ │
│  │ Feb 28     │ Diwali fund is now │ 120        │ ✓118│ │
│  │ 10:30 AM   │ open for...        │            │ ✗ 2 │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Click row for delivery breakdown                        │
└─────────────────────────────────────────────────────────┘
```

### Delivery Detail View

| Metric                   | Value |
| ------------------------ | ----- |
| Total sent               | 42    |
| Delivered (WhatsApp)     | 38    |
| Delivered (SMS fallback) | 2     |
| Failed                   | 2     |
| Delivery rate            | 95.2% |

### Components

| Component            | Description                                     |
| -------------------- | ----------------------------------------------- |
| `BroadcastComposer`  | Message editor with variable insertion          |
| `RecipientFilter`    | Multi-criteria filter builder                   |
| `BroadcastScheduler` | Date/time picker with recurring option          |
| `BroadcastHistory`   | DataTable of past broadcasts                    |
| `BroadcastDetail`    | Delivery breakdown per recipient                |
| `MessagePreview`     | Shows 5 sample messages with variables resolved |

### API Endpoints

| Method | Endpoint                            | Description                      |
| ------ | ----------------------------------- | -------------------------------- |
| POST   | `/api/v1/broadcasts`                | Create + send/schedule broadcast |
| GET    | `/api/v1/broadcasts`                | List broadcast history           |
| GET    | `/api/v1/broadcasts/:id`            | Get delivery details             |
| DELETE | `/api/v1/broadcasts/:id`            | Cancel scheduled broadcast       |
| GET    | `/api/v1/broadcasts/:id/recipients` | Per-recipient delivery status    |

**Acceptance**: Scheduled broadcasts fire at correct time. Recurring broadcasts repeat monthly. Analytics show accurate delivery stats. Variable preview works. Recipient count updates as filters change.

---

## Phase 5 Definition of Done

- [ ] Per-RWA WhatsApp configuration works — messages send from RWA's own number
- [ ] All 14+ notification triggers fire correctly with proper templates
- [ ] Push notifications via Firebase FCM work on Chrome, Edge, Firefox
- [ ] FCM token management: register, refresh, revoke on logout
- [ ] Email channel sends receipts and reports with PDF attachments
- [ ] Email unsubscribe works with one-click List-Unsubscribe header
- [ ] Notification centre loads last 90 days, grouped by date
- [ ] Real-time notifications via Supabase Realtime
- [ ] Unread count badge accurate and updates in real-time
- [ ] Category filter in notification centre works
- [ ] Mark all as read works
- [ ] Notification preferences: channel toggles + type toggles
- [ ] Mandatory notifications bypass user preferences
- [ ] Scheduled broadcasts fire at correct time
- [ ] Recurring broadcasts repeat on schedule
- [ ] Broadcast analytics: sent/delivered/failed counts accurate
- [ ] Enhanced recipient filtering: by status, ownership, block, floor, festival
- [ ] Message variable preview shows correct sample data
