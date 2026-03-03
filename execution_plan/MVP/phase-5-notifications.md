# MVP Phase 5 — WhatsApp Notifications & Broadcast

**Duration**: ~1.5 weeks
**Goal**: 5 mandatory + 2 optional automated WhatsApp notifications, manual bulk broadcast with recipient filtering, SMS fallback.
**Depends on**: Phase 3 (payment triggers), Phase 2 (registration triggers)

---

## Task 5.1 — WhatsApp Business API Setup

### Configuration

- **BSP**: WATI (recommended for MVP) or Interakt
- **Account Model**: Option A — Platform-level single WhatsApp Business Account
  - Sender: "RWA Connect" (or platform brand name)
  - All societies share this sender number
  - Per-RWA branding in message body (society name included)
- **Meta Business Verification**: Complete before development starts (2-5 business days)
- **Template Approval**: Submit all 7 templates at least 2 weeks before launch

### Backend Setup

- `src/services/notifications.ts` — Core notification service
- `src/lib/whatsapp/client.ts` — WATI/Interakt API client
- `src/lib/sms/client.ts` — MSG91/Twilio SMS client
- Notification queue: BullMQ with Upstash Redis (serverless-compatible)
- Retry logic: 3 attempts, 5-minute intervals
- Fallback chain: WhatsApp → (wait 60s) → SMS

### Environment Variables

```
WATI_API_URL=
WATI_API_TOKEN=
WATI_SENDER_NUMBER=
MSG91_AUTH_KEY=
MSG91_SENDER_ID=
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
```

**Acceptance**: WATI API connected. Test message sent to internal number. SMS fallback tested.

---

## Task 5.2 — Message Templates (Meta-Approved)

All 7 templates must be submitted to Meta for pre-approval. Template format uses WhatsApp template syntax with variables.

### Template 1: Registration Submitted (Mandatory)

```
Trigger: Resident submits registration form
Recipient: Resident
Template Name: registration_submitted
---
Hi {{1}},

Your registration request for *{{2}}* has been submitted and is pending approval.

Your details:
• Name: {{1}}
• Unit: {{3}}

An admin will review your request shortly. You'll receive a message once approved.

— RWA Connect
```

Variables: `{{1}}` = Name, `{{2}}` = Society Name, `{{3}}` = Unit

### Template 2: Registration Approved (Mandatory)

```
Trigger: Admin approves registration
Recipient: Resident
Template Name: registration_approved
---
Welcome to *{{1}}*! 🎉

Your registration has been approved.

Your RWAID: *{{2}}*
Your ID Card: {{3}}

Save this link — it's your permanent digital ID card. You can show it at the gate or any society event.

— RWA Connect
```

Variables: `{{1}}` = Society Name, `{{2}}` = RWAID, `{{3}}` = Card URL

### Template 3: Registration Rejected (Mandatory)

```
Trigger: Admin rejects registration
Recipient: Resident
Template Name: registration_rejected
---
Hi {{1}},

Your registration for *{{2}}* was not approved.

Reason: {{3}}

You can re-apply with corrected details or contact your RWA Admin for help.

— RWA Connect
```

Variables: `{{1}}` = Name, `{{2}}` = Society Name, `{{3}}` = Reason

### Template 4: Payment Recorded (Mandatory)

```
Trigger: Admin records a payment
Recipient: Resident
Template Name: payment_recorded
---
Hi {{1}},

Payment of *₹{{2}}* received for *{{3}}*.

Receipt No: {{4}}
Download Receipt: {{5}}

Thank you for your timely payment!

— {{6}}
```

Variables: `{{1}}` = Name, `{{2}}` = Amount, `{{3}}` = Session, `{{4}}` = Receipt No, `{{5}}` = Receipt URL, `{{6}}` = Society Name

### Template 5: New Pending Registration — Admin Alert (Mandatory)

```
Trigger: New registration submitted
Recipient: RWA Admin(s)
Template Name: admin_new_registration
---
New Registration Alert 📋

*{{1}}* from Unit {{2}} has registered for *{{3}}*.

Status: Pending your approval.
Review: {{4}}

— RWA Connect
```

Variables: `{{1}}` = Resident Name, `{{2}}` = Unit, `{{3}}` = Society Name, `{{4}}` = Review URL

### Template 6: Fee Reminder — March 1 (Optional, opt-out)

```
Trigger: Cron job on March 1
Recipient: All active residents
Template Name: fee_reminder_annual
---
Hi {{1}},

Annual membership renewal for *{{2}}* is due by March 31.

Amount: *₹{{3}}*
Session: {{4}}

Please pay by the deadline to maintain active membership status.

— {{2}}
```

Variables: `{{1}}` = Name, `{{2}}` = Society Name, `{{3}}` = Annual Fee, `{{4}}` = Next Session

### Template 7: Fee Overdue (Optional, opt-out)

```
Trigger: After April 15 grace period
Recipient: Residents with Overdue status
Template Name: fee_overdue
---
Hi {{1}},

Your membership fee of *₹{{2}}* for session {{3}} at *{{4}}* is overdue.

Please pay at the earliest to avoid service disruption.

Contact your RWA Admin if you have questions.

— {{4}}
```

Variables: `{{1}}` = Name, `{{2}}` = Amount, `{{3}}` = Session, `{{4}}` = Society Name

**Implementation**:

- Store templates in `src/lib/whatsapp/templates.ts` as typed constants
- Each template has: `name`, `variables[]`, `triggerEvent`, `isOptional`
- Variable substitution happens server-side before sending

**Acceptance**: All 7 templates submitted to Meta. At least the 5 mandatory templates approved. Variables substitute correctly.

---

## Task 5.3 — Automated Notification Triggers

### Backend

- Each trigger fires a notification via the queue
- Notification record created in `notifications` table:
  ```
  { id, society_id, user_id, template_name, variables, channel, status, sent_at, delivered_at, failed_at, retry_count }
  ```

### Trigger Integration Points

| Trigger                  | Where It Fires                        | API/Code Location               |
| ------------------------ | ------------------------------------- | ------------------------------- |
| Registration submitted   | `POST /api/v1/register/[societyCode]` | After successful registration   |
| Registration approved    | `POST /api/v1/residents/[id]/approve` | After status change to APPROVED |
| Registration rejected    | `POST /api/v1/residents/[id]/reject`  | After status change to REJECTED |
| Payment recorded         | `POST /api/v1/fees/[feeId]/payments`  | After payment saved             |
| New registration (admin) | `POST /api/v1/register/[societyCode]` | Same as #1, different recipient |
| Fee reminder (March 1)   | Cron job: `/api/cron/fee-reminders`   | Scheduled daily, runs March 1   |
| Fee overdue (post grace) | Cron job: `/api/cron/fee-overdue`     | Scheduled daily, runs April 16+ |

### Queue Architecture

```
Registration API → Queue Job → WhatsApp API → Success
                                    ↓ (fail)
                              Retry (3x, 5min)
                                    ↓ (all fail)
                              SMS Fallback → Success
                                    ↓ (fail)
                              Mark as FAILED in DB
```

**Components**:

- `NotificationService` — Orchestrates template selection, variable substitution, queue dispatch
- `WhatsAppClient` — WATI/Interakt API wrapper (send template, check delivery status)
- `SMSClient` — MSG91/Twilio wrapper (send OTP, send text)
- `NotificationQueue` — BullMQ job processor with retry logic

**Acceptance**: All 5 mandatory triggers fire correctly. WhatsApp delivered. SMS fallback works. Failed notifications logged with reason.

---

## Task 5.4 — Notification Delivery Tracking

### Backend

- API: `GET /api/v1/societies/[id]/notifications` (admin view)
- Webhook: `POST /api/v1/webhooks/whatsapp` — WATI delivery status callbacks
- Status tracking: `QUEUED → SENT → DELIVERED → READ` or `QUEUED → SENT → FAILED`

### UI Screen: `/admin/notifications` (tab within Broadcast page)

```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar]  │  Notifications                                │
│             │────────────────────────────────────────────────│
│  Dashboard  │                                                │
│  Residents  │  [Broadcast]  [Delivery Log]                   │
│  Fees       │                                                │
│  Expenses   │  Delivery Log                                  │
│  Reports    │  ─────────────                                 │
│  Broadcast←│  Last 7 days  │ From: [____]  To: [____]       │
│             │                                                │
│             │  Summary                                       │
│             │  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│             │  │ Sent: 47 │ │Delivered │ │ Failed:3 │      │
│             │  │          │ │   44     │ │          │      │
│             │  └──────────┘ └──────────┘ └──────────┘      │
│             │                                                │
│             │  ┌───────────────────────────────────────────┐│
│             │  │ Time     │ Recipient    │Template  │Status ││
│             │  │──────────│──────────────│──────────│───────││
│             │  │ 14:32    │ Hemant K.    │Payment   │✅ Dlvd││
│             │  │ 14:32    │ Hemant K.    │Receipt   │✅ Dlvd││
│             │  │ 12:15    │ Priya S.     │Approved  │✅ Dlvd││
│             │  │ 12:14    │ Priya S.     │Admin Alrt│✅ Dlvd││
│             │  │ 10:05    │ Amit V.      │Overdue   │❌ Fail││
│             │  │          │              │          │SMS ✅ ││
│             │  └───────────────────────────────────────────┘│
│             │  Showing 1-10 of 47        [< 1 2 3 4 5 >]   │
└─────────────┴───────────────────────────────────────────────┘
```

**Components to build**:

- `DeliveryLogTable` — DataTable with notification delivery history
- `DeliveryStatusBadge` — ✅ Delivered / ⏳ Sent / ❌ Failed / 📱 SMS Fallback
- `DeliverySummaryCards` — Sent, Delivered, Failed counts
- Use shadcn `Table`, `Badge`, `Tabs`, `DatePicker`

**Acceptance**: All sent notifications visible in log. Status updates via webhook. Failed notifications show SMS fallback status.

---

## Task 5.5 — Manual Bulk Broadcast

### Backend

- API: `POST /api/v1/societies/[id]/broadcasts`
- Body:
  ```json
  {
    "message": "Dear {Name}, maintenance work on {Date}...",
    "recipientFilter": "ALL_ACTIVE" | "FEE_PENDING" | "FEE_OVERDUE" | "CUSTOM",
    "customRecipientIds": [],
    "scheduledAt": null
  }
  ```
- Variable substitution: `{Name}`, `{HouseNo}`, `{Amount}`, `{DueDate}`
- Each recipient gets an individual WhatsApp DM (not group message)
- Broadcast log: admin name, timestamp, recipient count, message, delivery stats

### UI Screen: `/admin/broadcast` (Broadcast tab)

```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar]  │  Broadcast                                    │
│             │────────────────────────────────────────────────│
│  Dashboard  │                                                │
│  Residents  │  [Broadcast]  [Delivery Log]                   │
│  Fees       │                                                │
│  Expenses   │  Compose Broadcast                             │
│  Reports    │  ─────────────────                             │
│  Broadcast←│                                                │
│             │  Recipients *                                  │
│             │  ┌────────────────────────────────────────┐   │
│             │  │ All Active Residents               ▾   │   │
│             │  └────────────────────────────────────────┘   │
│             │  Options: All Active / Fee Pending /           │
│             │  Fee Overdue / Custom Selection                │
│             │                                                │
│             │  Selected: 42 residents                        │
│             │                                                │
│             │  Message *                                     │
│             │  ┌────────────────────────────────────────┐   │
│             │  │ Dear {Name},                           │   │
│             │  │                                        │   │
│             │  │ Water supply will be disrupted on      │   │
│             │  │ March 5 from 10 AM to 2 PM due to     │   │
│             │  │ pipeline repair work.                  │   │
│             │  │                                        │   │
│             │  │ Please store water in advance.         │   │
│             │  │                                        │   │
│             │  │ Regards,                               │   │
│             │  │ Eden Estate RWA                        │   │
│             │  └────────────────────────────────────────┘   │
│             │                                                │
│             │  Available Variables:                           │
│             │  [{Name}] [{HouseNo}] [{Amount}] [{DueDate}]  │
│             │  Click to insert at cursor                     │
│             │                                                │
│             │  Preview (for: Hemant Kumar, S22-H245)         │
│             │  ┌────────────────────────────────────────┐   │
│             │  │ Dear Hemant Kumar,                     │   │
│             │  │                                        │   │
│             │  │ Water supply will be disrupted on      │   │
│             │  │ March 5 from 10 AM to 2 PM due to     │   │
│             │  │ pipeline repair work.                  │   │
│             │  │                                        │   │
│             │  │ Please store water in advance.         │   │
│             │  │                                        │   │
│             │  │ Regards,                               │   │
│             │  │ Eden Estate RWA                        │   │
│             │  └────────────────────────────────────────┘   │
│             │                                                │
│             │           [Cancel]  [Send to 42 Recipients]   │
└─────────────┴───────────────────────────────────────────────┘
```

### UI: Broadcast Confirmation

```
┌─────────────────────────────────────────────────┐
│  Confirm Broadcast                         [✕]  │
│  ───────────────────────────────────────────     │
│                                                  │
│  ⚠ You are about to send a WhatsApp message to: │
│                                                  │
│  Recipients: 42 active residents                 │
│  Channel: WhatsApp (SMS fallback if needed)      │
│                                                  │
│  This action cannot be undone.                   │
│                                                  │
│            [Go Back]  [Confirm & Send]           │
└─────────────────────────────────────────────────┘
```

### UI: After Broadcast Sent

```
┌─────────────────────────────────────────────────┐
│  ✅ Broadcast Sent                               │
│  ───────────────────────────────────────────     │
│                                                  │
│  Queued: 42 messages                             │
│  Estimated delivery: 1-2 minutes                 │
│                                                  │
│  Track delivery in the Delivery Log tab.         │
│                                                  │
│  [View Delivery Log]  [Compose Another]  [Done]  │
└─────────────────────────────────────────────────┘
```

**Components to build**:

- `BroadcastComposer` — Full broadcast composition form
- `RecipientFilter` — Dropdown with filter options + count display
- `VariableChips` — Clickable variable insertion chips ({Name}, {HouseNo}, etc.)
- `MessagePreview` — Live preview with variables substituted for a sample resident
- `BroadcastConfirmDialog` — Final confirmation before sending
- `BroadcastSuccessCard` — Post-send status with link to delivery log
- Use shadcn `Tabs`, `Textarea`, `Select`, `Dialog`, `Button`, `Badge`

**Acceptance**: Broadcast sends individual messages to all selected recipients. Variables substituted correctly. Preview shows real data. Confirmation required before send. Broadcast logged.

---

## Task 5.6 — Broadcast History

### Backend

- API: `GET /api/v1/societies/[id]/broadcasts` (paginated)
- Returns: broadcast list with delivery stats per broadcast

### UI: Broadcast History (below composer or as separate section)

```
┌─────────────────────────────────────────────────────────────┐
│  Past Broadcasts                                             │
│  ────────────────                                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 04 Mar 2026 at 14:32 — by Hemant Kumar              │    │
│  │ "Dear {Name}, Water supply will be disrupted..."     │    │
│  │ Recipients: 42 │ ✅ 40 delivered │ ❌ 2 failed       │    │
│  │                                        [View Detail] │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ 01 Mar 2026 at 09:00 — System (Auto)                │    │
│  │ Fee reminder: Annual renewal due by March 31         │    │
│  │ Recipients: 42 │ ✅ 41 delivered │ ❌ 1 failed       │    │
│  │                                        [View Detail] │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ 15 Feb 2026 at 16:45 — by Hemant Kumar              │    │
│  │ "Dear {Name}, AGM scheduled for Feb 28..."           │    │
│  │ Recipients: 42 │ ✅ 42 delivered │ ❌ 0 failed       │    │
│  │                                        [View Detail] │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Components to build**:

- `BroadcastHistoryList` — List of past broadcasts with delivery stats
- `BroadcastDetailSheet` — Per-broadcast detail showing per-recipient delivery status

**Acceptance**: All past broadcasts listed. Delivery stats (delivered/failed) shown. Detail view per broadcast available.

---

## Task 5.7 — Resident Notification Preferences

### Backend

- API: `GET /api/v1/residents/me/notification-preferences`
- API: `PATCH /api/v1/residents/me/notification-preferences`
- Mandatory notifications (registration, payment) cannot be opted out
- Optional notifications (fee reminder, overdue) can be opted out

### UI: Within Resident Profile (`/resident/profile`)

```
┌─────────────────────────────────────────────────┐
│  Notification Preferences                        │
│  ───────────────────────────────────────────     │
│                                                  │
│  Mandatory (cannot be turned off)                │
│  ┌────────────────────────────────────────┐     │
│  │ Registration updates        Always on  │     │
│  │ Payment receipts            Always on  │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  Optional                                        │
│  ┌────────────────────────────────────────┐     │
│  │ Fee reminders           [■ On ] / Off  │     │
│  │ Overdue alerts          [■ On ] / Off  │     │
│  │ Society broadcasts       On  / [■ Off] │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  ℹ Mandatory notifications ensure you receive    │
│  important updates about your registration and   │
│  payments. These cannot be disabled.             │
└─────────────────────────────────────────────────┘
```

**Components to build**:

- `NotificationPreferences` — Section within profile page
- `PreferenceToggle` — Toggle switch (disabled for mandatory items)
- Use shadcn `Switch`, `Card`

**Acceptance**: Mandatory notifications always on (toggle disabled). Optional notifications toggleable. Preferences persist. Opted-out residents excluded from optional broadcasts.

---

## Phase 5 Definition of Done

- [ ] WhatsApp Business API connected (WATI or Interakt)
- [ ] All 7 message templates submitted to Meta
- [ ] At least 5 mandatory templates approved and functional
- [ ] Registration submitted → WhatsApp to resident
- [ ] Registration approved → WhatsApp with RWAID + card link
- [ ] Registration rejected → WhatsApp with reason
- [ ] Payment recorded → WhatsApp with receipt + download link
- [ ] New registration → WhatsApp alert to admin(s)
- [ ] Fee reminder (March 1) → WhatsApp to all active residents
- [ ] Fee overdue (post April 15) → WhatsApp to overdue residents
- [ ] SMS fallback: triggers after 60s WhatsApp failure
- [ ] 3 retries with 5-minute intervals before fallback
- [ ] Failed notifications logged with reason
- [ ] Delivery log: shows all notifications with status
- [ ] Broadcast composer: recipient filter + variables + preview
- [ ] Broadcast confirmation dialog before sending
- [ ] Broadcast history with delivery stats per broadcast
- [ ] Resident notification preferences: opt-out for optional triggers
- [ ] Mandatory notifications cannot be opted out
