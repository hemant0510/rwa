# Enums & Configuration Reference — v3.0

**Source**: Full Spec v3.0 Section 19
**Purpose**: Single source of truth for every enumerated type. Developers use this for dropdowns, status badges, state machines, and database enums.

---

## 19.1 User Role

| Value                  | Meaning                           | When Set                                        |
| ---------------------- | --------------------------------- | ----------------------------------------------- |
| `SUPER_ADMIN`          | Platform owner account            | Created at deployment. One per platform.        |
| `RWA_ADMIN_PRIMARY`    | Full access elected admin         | Super Admin activates at onboarding or election |
| `RWA_ADMIN_SUPPORTING` | Configurable access elected admin | Super Admin activates supporting position       |
| `RESIDENT_OWNER`       | Property owner                    | Registration approval when Ownership = Owner    |
| `RESIDENT_OWNER_NRO`   | Non-resident property owner       | Owner marks themselves as non-resident          |
| `RESIDENT_JOINT_OWNER` | Second owner of same unit         | System detects same unit with different mobile  |
| `RESIDENT_TENANT`      | Tenant occupant                   | Registration approval when Ownership = Tenant   |

---

## 19.2 Resident Account Status

| Value                     | Meaning                             | When Set                                        |
| ------------------------- | ----------------------------------- | ----------------------------------------------- |
| `ACTIVE_PAID`             | Fee fully paid for session          | Payment brings balance to zero                  |
| `ACTIVE_PENDING`          | Within grace period, unpaid         | April 1 each year for all active                |
| `ACTIVE_OVERDUE`          | Past grace period, unpaid           | 11:59 PM on grace period end date               |
| `ACTIVE_PARTIAL`          | Partial fee paid                    | Payment recorded but < full amount              |
| `ACTIVE_EXEMPTED`         | Fee waived by admin                 | Primary Admin or Treasurer records exemption    |
| `ACTIVE_LIFETIME`         | Honorary lifetime, no annual fee    | Super Admin only. Cannot be undone by RWA Admin |
| `MIGRATED_PENDING`        | Bulk imported, not activated        | On bulk import                                  |
| `MIGRATED_DORMANT`        | 60+ days without activation         | Auto-set 60 days post-import                    |
| `TRANSFERRED_DEACTIVATED` | Property sold, archived             | Admin initiates Ownership Transfer              |
| `TENANT_DEPARTED`         | Tenant vacated, archived            | Admin marks tenant departure                    |
| `SUSPENDED`               | Manually suspended                  | Primary Admin with reason                       |
| `DECEASED`                | Owner deceased, archived            | Primary Admin. Heir registers fresh             |
| `BLACKLISTED`             | Mobile blocked from re-registration | Primary Admin. Admin-visible only               |

---

## 19.3 Admin Term Status

| Value      | Meaning                         | When Set                                 |
| ---------- | ------------------------------- | ---------------------------------------- |
| `ACTIVE`   | Live, full permissions per role | Super Admin activates                    |
| `EXPIRED`  | Term ended, read-only access    | Auto-set on term end date                |
| `EXTENDED` | Temporary extension granted     | Super Admin. Max 2 × 30 days             |
| `VACATED`  | Mid-term vacancy                | Super Admin on request                   |
| `ARCHIVED` | Historical record, no access    | After new admins activated post-election |

---

## 19.4 Fee Status (per Session)

| Value          | Meaning                                   | When Set                           |
| -------------- | ----------------------------------------- | ---------------------------------- |
| `PAID`         | Full amount received                      | Payments = amount due              |
| `PARTIAL`      | Some paid, balance outstanding            | Payment < full due                 |
| `PENDING`      | Session started, within grace, no payment | April 1 for all accounts           |
| `OVERDUE`      | Past grace, still unpaid                  | Auto-set at grace period end       |
| `ADVANCE_PAID` | Next session paid before April 1          | Payment tagged to future session   |
| `EXEMPTED`     | Fee waived for this session               | Admin records with reason          |
| `LIFETIME`     | Annual fee never applicable               | Super Admin grants lifetime        |
| `NOT_YET_DUE`  | New member, first payment not processed   | Between approval and first payment |

---

## 19.5 Payment Entry Type

| Value             | Meaning                     | When Set                                 |
| ----------------- | --------------------------- | ---------------------------------------- |
| `PAYMENT`         | Standard fee payment        | Admin records new payment                |
| `PARTIAL_PAYMENT` | Less than full amount       | System determines from amount vs balance |
| `CORRECTION`      | Edit within 48 hours        | Admin edits recent entry                 |
| `REVERSAL`        | Cancellation after 48 hours | Admin creates reversal                   |
| `REFUND`          | Money returned to resident  | Admin records with reason                |
| `WRITE_OFF`       | Uncollectable arrear        | Admin marks transferred/deceased arrear  |
| `EXEMPTION`       | Fee marked exempt           | Admin creates exemption record           |

---

## 19.6 Payment Mode

| Value           | Meaning                    | Reference Required              |
| --------------- | -------------------------- | ------------------------------- |
| `CASH`          | Physical currency          | Optional                        |
| `UPI`           | GPay, PhonePe, Paytm, etc. | Mandatory (UPI transaction ref) |
| `BANK_TRANSFER` | NEFT / RTGS / IMPS         | Mandatory (UTR number)          |
| `CHEQUE`        | Physical cheque            | Mandatory (cheque number)       |
| `ONLINE`        | Payment gateway (Phase 6)  | System-set via Razorpay/PayU    |

---

## 19.7 Expense Category

| Value            | Meaning                                 | Notes                            |
| ---------------- | --------------------------------------- | -------------------------------- |
| `MAINTENANCE`    | Building/area upkeep, repairs           | —                                |
| `SECURITY`       | Guard salary, CCTV, barriers            | —                                |
| `CLEANING`       | Sweeper, garbage, sanitation            | —                                |
| `STAFF_SALARY`   | Society staff payroll                   | Not covered by Security/Cleaning |
| `INFRASTRUCTURE` | Roads, landscaping, wiring              | —                                |
| `UTILITIES`      | Common electricity, water, internet     | —                                |
| `FESTIVAL`       | Festival/event spend                    | Links to Festival ID             |
| `EMERGENCY`      | Unplanned urgent repairs                | Description mandatory            |
| `LEGAL`          | Legal fees, notices, court filings      | —                                |
| `ADMINISTRATIVE` | Office supplies, printing, bank charges | —                                |
| `OTHER`          | Anything else                           | Description mandatory            |

---

## 19.8 Expense Entry Status

| Value      | Meaning                    | When Set               |
| ---------- | -------------------------- | ---------------------- |
| `ACTIVE`   | Valid, current entry       | On creation            |
| `REVERSED` | Marked invalid, superseded | Admin creates reversal |

---

## 19.9 Festival Status

| Value        | Meaning                               | When Set                         |
| ------------ | ------------------------------------- | -------------------------------- |
| `DRAFT`      | Created, not published                | On creation. All fields editable |
| `COLLECTING` | Published, accepting contributions    | Admin publishes                  |
| `CLOSED`     | Collection ended, expenses finalising | Auto-set on collection end date  |
| `COMPLETED`  | Settlement report published           | Admin posts final report         |
| `CANCELLED`  | Cancelled, disposal in progress       | Admin cancels with reason        |

---

## 19.10 Festival Surplus Disposal

| Value                 | Meaning                  | When Set                          |
| --------------------- | ------------------------ | --------------------------------- |
| `CARRY_FORWARD`       | Surplus to next festival | Admin in settlement               |
| `TRANSFER_TO_SOCIETY` | Surplus to main fund     | Admin in settlement               |
| `REFUND_CONTRIBUTORS` | Proportional refund      | Admin triggers individual refunds |

---

## 19.11 Notification Channel

| Value      | Meaning                  | When Set                         |
| ---------- | ------------------------ | -------------------------------- |
| `WHATSAPP` | Meta Business API        | Primary for all notifications    |
| `SMS`      | MSG91 / Twilio           | Fallback when WhatsApp fails     |
| `PUSH`     | Firebase Cloud Messaging | PWA / mobile app users (Phase 6) |
| `EMAIL`    | SMTP / SendGrid          | Receipts and reports only        |

---

## 19.12 Notification Delivery Status

| Value       | Meaning               | When Set              |
| ----------- | --------------------- | --------------------- |
| `QUEUED`    | In queue, not sent    | On creation           |
| `SENT`      | Dispatched to API     | API call succeeds     |
| `DELIVERED` | Confirmed on device   | Meta/SMS API confirms |
| `FAILED`    | All retries exhausted | After 3 retries fail  |
| `RETRYING`  | Retry in progress     | During retry interval |

---

## 19.13 Society Status

| Value        | Meaning                              | When Set                      |
| ------------ | ------------------------------------ | ----------------------------- |
| `TRIAL`      | Free trial (60 days)                 | On creation if no paid plan   |
| `ACTIVE`     | Paid subscription, full access       | Subscription payment recorded |
| `SUSPENDED`  | Lapsed 15-90 days, read-only         | Auto-set on lapse             |
| `OFFBOARDED` | Left platform, data pending deletion | After export + confirmation   |

---

## 19.14 Subscription Plan

| Value        | Meaning     | Limits                          |
| ------------ | ----------- | ------------------------------- |
| `BASIC`      | Entry tier  | ≤100 residents, no WhatsApp API |
| `STANDARD`   | Mid tier    | ≤500 residents, 500 WhatsApp/mo |
| `PREMIUM`    | Full tier   | Unlimited, 2,000 WhatsApp/mo    |
| `ENTERPRISE` | Custom      | Multi-society, white-label      |
| `TRIAL`      | 60-day free | Standard features               |

---

## 19.15 Ownership Type

| Value         | Meaning                    | When Set                             |
| ------------- | -------------------------- | ------------------------------------ |
| `OWNER`       | Owns and lives in property | Registration with Ownership = Owner  |
| `OWNER_NRO`   | Owns but lives elsewhere   | Owner updates profile                |
| `JOINT_OWNER` | Second owner of same unit  | System detects on registration       |
| `TENANT`      | Renter, does not own       | Registration with Ownership = Tenant |

---

## 19.16 Transfer / Departure Type

| Value                   | Meaning                           | When Set                 |
| ----------------------- | --------------------------------- | ------------------------ |
| `OWNERSHIP_SALE`        | Unit sold to new person           | Admin initiates transfer |
| `TENANT_DEPARTURE`      | Tenant vacated                    | Admin marks departure    |
| `BUILDER_FLOOR_PARTIAL` | Multi-floor owner sells one floor | Unit-level operation     |
| `INHERITANCE`           | Owner deceased, heir takes over   | Admin marks deceased     |

---

## 19.17 Society Type

| Value                       | Meaning                       | Unit Address Fields                    |
| --------------------------- | ----------------------------- | -------------------------------------- |
| `APARTMENT_COMPLEX`         | Multi-storey building         | Tower/Block + Floor + Flat             |
| `BUILDER_FLOORS`            | Floor-by-floor ownership      | House No + Floor (GF/1F/2F/3F/Terrace) |
| `GATED_COMMUNITY_VILLAS`    | Villas inside managed gate    | Villa No + Street/Phase                |
| `INDEPENDENT_SECTOR_COLONY` | Open area — sectors, mohallas | House No + Street/Gali + Sector/Block  |
| `PLOTTED_COLONY`            | Individual plots              | Plot No + Lane No + Phase              |

---

## 19.18 Registration Rejection Reason

| Value                   | Meaning                           | Notes                     |
| ----------------------- | --------------------------------- | ------------------------- |
| `NOT_RESIDENT`          | Not a resident/owner              | —                         |
| `DUPLICATE_ENTRY`       | Mobile or unit already registered | —                         |
| `INCORRECT_INFORMATION` | Details don't match records       | —                         |
| `UNDER_VERIFICATION`    | Temporary hold                    | Registration stays active |
| `ADMIN_DISCRETION`      | Other reason                      | Note mandatory            |
