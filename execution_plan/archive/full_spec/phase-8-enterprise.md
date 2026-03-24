# Full Spec Phase 8 — Enterprise & Global

**Duration**: ~6+ months
**Goal**: White-label multi-tenant platform, full multi-language support (8+ locales with RTL), international expansion (UAE, UK, Singapore), GDPR compliance, AI-powered anomaly detection, public API marketplace, builder white-label, and advanced analytics.
**Depends on**: Phase 6 (Mobile App & Payments shipped)
**Source**: Full Spec v3.0 Sections on Enterprise, Global Expansion, Business Model, Legal/Compliance, Market Analysis, International

---

## Task 8.1 — White-Label System

### Overview

Transform RWA Connect from a single-brand SaaS into a white-label platform where Enterprise clients can fully rebrand the product as their own. Each tenant gets custom branding, domain, email templates, RWAID card designs, and admin panel styling.

### Backend

| Method   | Endpoint                                   | Purpose                                          |
| -------- | ------------------------------------------ | ------------------------------------------------ |
| `POST`   | `/api/v1/tenants`                          | Create new white-label tenant (Super Admin only) |
| `GET`    | `/api/v1/tenants`                          | List all tenants with status, plan, domain       |
| `GET`    | `/api/v1/tenants/[id]`                     | Tenant detail with branding config               |
| `PATCH`  | `/api/v1/tenants/[id]/branding`            | Update branding (logo, colors, fonts)            |
| `POST`   | `/api/v1/tenants/[id]/domain`              | Map custom domain                                |
| `DELETE` | `/api/v1/tenants/[id]/domain`              | Remove custom domain mapping                     |
| `GET`    | `/api/v1/tenants/[id]/preview`             | Preview branded login page                       |
| `PATCH`  | `/api/v1/tenants/[id]/email-templates`     | Update branded email templates                   |
| `PATCH`  | `/api/v1/tenants/[id]/notification-sender` | Set branded notification sender name             |

### Tenant Branding Schema

```typescript
interface TenantBranding {
  tenantId: string;
  // Visual Identity
  logoUrl: string; // Primary logo (min 200x200, max 2MB)
  logoIconUrl: string; // Favicon / small icon (32x32, 64x64)
  primaryColor: string; // Hex color (e.g., #1E40AF)
  secondaryColor: string; // Hex color
  accentColor: string; // Hex color
  fontFamily: string; // Google Font name or system font
  // Domain
  customDomain: string | null; // e.g., mycolony.rwaconnect.in
  sslStatus: "PENDING" | "ACTIVE" | "FAILED";
  // RWAID Card
  cardLogoUrl: string; // Logo printed on RWAID cards
  cardBackgroundColor: string; // Card background
  cardTextColor: string; // Card text color
  // Email
  emailFromName: string; // e.g., "MyColony Admin"
  emailFromDomain: string; // e.g., "notifications@mycolony.rwaconnect.in"
  emailHeaderHtml: string; // Custom email header
  emailFooterHtml: string; // Custom email footer
  // Notification
  smsSenderId: string; // 6-char SMS sender (e.g., MYCOLO)
  whatsappDisplayName: string; // WhatsApp sender display name
  // CSS Override
  cssOverride: string; // Raw CSS for theme overrides
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

### Custom Domain Mapping Flow

```
1. Client enters desired domain: mycolony.rwaconnect.in
2. System generates DNS instructions:
   - CNAME: mycolony.rwaconnect.in → tenants.rwaconnect.in
   - TXT: _verify.mycolony → [verification-token]
3. Client configures DNS at their registrar
4. System polls DNS every 5 minutes (max 48 hours)
5. DNS verified → Auto-provision SSL via Let's Encrypt
6. SSL active → Domain goes live
```

### UI Screen: White-Label Configuration Panel

```
+------------------------------------------------------------------+
|  [Sidebar]  |  White-Label Configuration                          |
|             |-----------------------------------------------------+
|  Tenants    |                                                     |
|  Branding<--|  Tenant: Sunshine Towers                            |
|  Domains    |  Plan: Enterprise  |  Status: Active                |
|  Templates  |  ---------------------------------------------------+
|  Preview    |                                                     |
|             |  Brand Identity                                     |
|             |  +---------+  Primary Logo                          |
|             |  | [LOGO]  |  [Upload New]  [Remove]                |
|             |  | 200x200 |  Accepted: PNG, SVG (max 2MB)          |
|             |  +---------+                                        |
|             |                                                     |
|             |  Colors                                             |
|             |  Primary     Secondary    Accent                    |
|             |  [#1E40AF]   [#64748B]    [#F59E0B]                 |
|             |  [==color=]  [==color=]   [==color=]                |
|             |                                                     |
|             |  Font Family                                        |
|             |  +--------------------------------------+           |
|             |  | Inter (Google Fonts)           [ v ] |           |
|             |  +--------------------------------------+           |
|             |                                                     |
|             |  Custom Domain                                      |
|             |  +--------------------------------------+           |
|             |  | mycolony.rwaconnect.in               |           |
|             |  +--------------------------------------+           |
|             |  SSL Status: Active (expires 2027-02-15)            |
|             |                                                     |
|             |  RWAID Card Preview                                 |
|             |  +--------------------------------------+           |
|             |  | [LOGO]  SUNSHINE TOWERS              |           |
|             |  |         Resident: Hemant Kumar        |           |
|             |  |         RWAID: #0089                  |           |
|             |  |         Unit: A-204                   |           |
|             |  |         [QR CODE]                     |           |
|             |  +--------------------------------------+           |
|             |                                                     |
|             |  CSS Override (Advanced)                             |
|             |  +--------------------------------------+           |
|             |  | :root {                              |           |
|             |  |   --sidebar-bg: #0F172A;             |           |
|             |  |   --header-height: 64px;             |           |
|             |  | }                                    |           |
|             |  +--------------------------------------+           |
|             |                                                     |
|             |       [Preview Live]   [Save Changes]               |
+-------------+-----------------------------------------------------+
```

### Components to Build

- `TenantListPage` — All white-label tenants with status
- `BrandingEditor` — Logo upload, color pickers, font selector
- `DomainManager` — Custom domain setup with DNS verification status
- `EmailTemplateEditor` — WYSIWYG editor for branded email header/footer
- `RWAIDCardPreview` — Live preview of branded RWAID card
- `CSSOverrideEditor` — Code editor with syntax highlighting for CSS overrides
- `BrandPreviewPanel` — Live preview of branded login page and dashboard

### Pricing

Enterprise plan: custom pricing, negotiated per client. Includes:

- Unlimited societies under one tenant
- Custom domain
- Branded RWAID cards
- Dedicated WhatsApp sender
- Priority support
- SLA guarantee (99.9% uptime)

### Acceptance Criteria

- [ ] Tenant created with unique slug and branding defaults applied
- [ ] Logo uploaded and displayed across all pages (header, login, RWAID card, email)
- [ ] Color scheme applied globally via CSS custom properties; all components respect tenant theme
- [ ] Custom domain mapped with automated SSL provisioning; DNS verification within 48 hours
- [ ] RWAID cards render with client branding (logo, colors, text) in both digital and printable formats
- [ ] Email templates use client branding (logo in header, custom footer, sender name)
- [ ] SMS and WhatsApp notifications sent from client-branded sender names
- [ ] CSS override applies without breaking core layout or accessibility
- [ ] Preview mode shows branded login page before going live
- [ ] Tenant isolation: no data or branding leaks between tenants

---

## Task 8.2 — Multi-Language UI (8+ Locales)

### Overview

Expand the next-intl i18n framework (scaffolded in Phase 1 for English) to support Hindi and 6 additional regional languages plus Arabic with full RTL support. Each society can set a default language, and users can override with their own preference.

### Supported Locales

| Code | Language | Script     | Direction | Status           |
| ---- | -------- | ---------- | --------- | ---------------- |
| `en` | English  | Latin      | LTR       | Phase 1 (base)   |
| `hi` | Hindi    | Devanagari | LTR       | Phase 2 addition |
| `ta` | Tamil    | Tamil      | LTR       | New              |
| `te` | Telugu   | Telugu     | LTR       | New              |
| `bn` | Bengali  | Bengali    | LTR       | New              |
| `mr` | Marathi  | Devanagari | LTR       | New              |
| `gu` | Gujarati | Gujarati   | LTR       | New              |
| `kn` | Kannada  | Kannada    | LTR       | New              |
| `ar` | Arabic   | Arabic     | RTL       | New              |

### Backend

| Method  | Endpoint                          | Purpose                                |
| ------- | --------------------------------- | -------------------------------------- |
| `PATCH` | `/api/v1/societies/[id]/settings` | Set society default language           |
| `PATCH` | `/api/v1/users/[id]/preferences`  | Set user language preference           |
| `GET`   | `/api/v1/i18n/[locale]`           | Fetch translation bundle for locale    |
| `GET`   | `/api/v1/i18n/status`             | Translation coverage report per locale |
| `POST`  | `/api/v1/i18n/[locale]/keys`      | Submit translation (admin-contributed) |

### Language Fallback Chain

```
User selected language
  |
  +---> Translation found? --YES--> Use it
  |
  NO
  |
  v
Society default language
  |
  +---> Translation found? --YES--> Use it
  |
  NO
  |
  v
English (always complete -- base language)
```

### RTL Layout System (Arabic)

```
LTR Layout (English, Hindi, etc.)        RTL Layout (Arabic)
+----+---------------------------+       +---------------------------+----+
|Side|  Content                  |       |  Content                  |Side|
|bar |                           |       |                           |bar |
|    |  [Left-aligned text]      |       |      [Right-aligned text] |    |
|    |                           |       |                           |    |
|    |  [Icon] Label    [Action] |       | [Action]    Label [Icon]  |    |
+----+---------------------------+       +---------------------------+----+
```

RTL implementation details:

- `dir="rtl"` on `<html>` when Arabic is active
- Tailwind CSS logical properties: `ms-4` / `me-4` instead of `ml-4` / `mr-4`
- Mirrored icons (arrows, chevrons, navigation)
- Bidirectional text handling for mixed content (Arabic + English in same paragraph)
- Number formatting: Arabic-Indic numerals optional, Western numerals default

### UI Screen: Language Selection

```
+------------------------------------------------------------------+
|  Language & Region Settings                                       |
|  -----------------------------------------------------------------+
|                                                                   |
|  Your Language Preference                                         |
|  +--------------------------------------+                        |
|  | English                        [ v ] |                        |
|  +--------------------------------------+                        |
|                                                                   |
|  Available Languages                                              |
|  +----------------------------------------------------------+   |
|  |  [*] English          [ ] Tamil           [ ] Gujarati    |   |
|  |  [ ] Hindi            [ ] Telugu          [ ] Kannada     |   |
|  |  [ ] Bengali          [ ] Marathi         [ ] Arabic      |   |
|  +----------------------------------------------------------+   |
|                                                                   |
|  RTL Preview (Arabic)                                             |
|  +----------------------------------------------------------+   |
|  |  +---------------------------------------------+----+    |   |
|  |  |  Dashboard                     RWA Connect   |Side|    |   |
|  |  |                                              |bar |    |   |
|  |  |  Total Residents: 42     Collected: 85%      |    |    |   |
|  |  |  [Right-to-left layout active]               |    |    |   |
|  |  +---------------------------------------------+----+    |   |
|  +----------------------------------------------------------+   |
|                                                                   |
|  Society Default Language (Admin only)                            |
|  +--------------------------------------+                        |
|  | Hindi                          [ v ] |                        |
|  +--------------------------------------+                        |
|  Note: Residents see this language unless they override it.       |
|                                                                   |
|  Number & Date Format                                             |
|  Numbers:  1,00,000 (Indian)  |  Currency: Rs 1,00,000           |
|  Dates:    04/03/2026 (DD/MM/YYYY)                               |
|                                                                   |
|           [Save Preferences]                                      |
+------------------------------------------------------------------+
```

### Translation Management Workflow

1. English keys defined as base (developer-authored)
2. Professional translation for Hindi + Tamil + Telugu (outsourced)
3. Community-contributed translations for remaining languages
4. Admin review and approval of community translations
5. Coverage dashboard: shows percentage complete per locale
6. Missing key alerts: flag untranslated keys per locale

### Number / Date / Currency Formatting

| Locale  | Number   | Currency    | Date        |
| ------- | -------- | ----------- | ----------- |
| `en`    | 1,00,000 | Rs 1,00,000 | 04 Mar 2026 |
| `hi`    | 1,00,000 | Rs 1,00,000 | 04 Mar 2026 |
| `ar`    | 100,000  | AED 100,000 | 2026/03/04  |
| `en-GB` | 100,000  | GBP 100,000 | 04/03/2026  |
| `en-SG` | 100,000  | SGD 100,000 | 04/03/2026  |

### Components to Build

- `LanguageSelector` — Dropdown with flag icons and language names in native script
- `RTLProvider` — Context provider that sets document direction and body class
- `TranslationCoverageDashboard` — Admin view of translation completeness
- `LocaleFormatProvider` — Context for number/date/currency formatting per locale
- `BiDirectionalText` — Component for mixed LTR/RTL content blocks

### Acceptance Criteria

- [ ] All 9 locales selectable from user preferences
- [ ] Language fallback chain works: user pref -> society default -> English
- [ ] RTL layout fully functional for Arabic: sidebar, forms, tables, modals all mirrored
- [ ] Bidirectional text renders correctly for mixed Arabic/English content
- [ ] Browser language auto-detected on first visit and suggested to user
- [ ] Admin can set society default language; new residents inherit it
- [ ] Number, date, and currency formatting respects active locale
- [ ] Translation coverage dashboard shows percentage per locale with missing key count
- [ ] All UI strings externalized via next-intl (zero hardcoded strings)
- [ ] Font loading handles Devanagari, Tamil, Telugu, Bengali, Gujarati, Kannada, Arabic scripts

---

## Task 8.3 — International Expansion

### Overview

Extend RWA Connect beyond India to serve three international markets: UAE (Owners' Associations), UK (Right to Manage companies), and Singapore (Management Corporation Strata Title). Each market requires country-specific terminology, currency, compliance, and integration readiness.

### Market Configuration Schema

```typescript
interface MarketConfig {
  countryCode: "IN" | "AE" | "GB" | "SG";
  currency: "INR" | "AED" | "GBP" | "SGD";
  currencySymbol: string; // Rs, AED, GBP, S$
  timezone: string; // Asia/Kolkata, Asia/Dubai, Europe/London, Asia/Singapore
  locale: string; // en-IN, ar-AE, en-GB, en-SG
  taxType: "GST" | "VAT" | "NONE";
  taxRate: number; // 18%, 5%, 20%, 9%
  terminology: TerminologyMap; // Country-specific labels
  complianceFramework: "IT_ACT" | "GDPR" | "PDPA" | "UAE_DATA";
  notificationProviders: NotificationProviderConfig;
}
```

### 8.3.1 UAE — Owners' Associations

| Aspect       | Configuration                                                       |
| ------------ | ------------------------------------------------------------------- |
| Currency     | AED (UAE Dirham)                                                    |
| Language     | Arabic (primary), English (secondary)                               |
| Layout       | RTL for Arabic, LTR for English                                     |
| Legal Entity | Owners' Association (OA)                                            |
| Tax          | 5% VAT                                                              |
| ID Format    | `OA-DXB-[AREA]-[SEQ]`                                               |
| Terminology  | Society -> Association, Flat -> Unit, Maintenance -> Service Charge |
| Compliance   | UAE Federal Decree-Law No. 5 of 2019 on Jointly Owned Property      |
| Integration  | Dubai Land Department (DLD) — readiness for e-services API          |
| Payment      | UAE payment gateways (Network International, Checkout.com)          |

### 8.3.2 UK — Right to Manage (RTM) Companies

| Aspect       | Configuration                                                                               |
| ------------ | ------------------------------------------------------------------------------------------- |
| Currency     | GBP (British Pound)                                                                         |
| Language     | English (en-GB)                                                                             |
| Layout       | LTR                                                                                         |
| Legal Entity | RTM Company / Management Company                                                            |
| Tax          | 20% VAT                                                                                     |
| ID Format    | `RTM-[POSTCODE]-[SEQ]`                                                                      |
| Terminology  | Society -> RTM Company, Flat -> Flat/Apartment, Fees -> Service Charges, RWAID -> Member ID |
| Compliance   | GDPR, UK Data Protection Act 2018, Leasehold Reform Act                                     |
| Integration  | Companies House (readiness for company filing API)                                          |
| Payment      | UK payment gateways (Stripe UK, GoCardless for direct debit)                                |

### 8.3.3 Singapore — MCST

| Aspect       | Configuration                                                                       |
| ------------ | ----------------------------------------------------------------------------------- |
| Currency     | SGD (Singapore Dollar)                                                              |
| Language     | English (en-SG)                                                                     |
| Layout       | LTR                                                                                 |
| Legal Entity | Management Corporation Strata Title (MCST)                                          |
| Tax          | 9% GST                                                                              |
| ID Format    | `MCST-[PLAN]-[SEQ]`                                                                 |
| Terminology  | Society -> MCST, Flat -> Unit, Fees -> Management Fund, RWAID -> Strata ID          |
| Compliance   | PDPA (Personal Data Protection Act), Building Maintenance and Strata Management Act |
| Integration  | BCA (Building and Construction Authority) — readiness for CORENET                   |
| Payment      | Singapore gateways (Stripe SG, PayNow QR)                                           |

### Multi-Currency Support

```typescript
// Currency configuration
const CURRENCIES = {
  INR: { symbol: "Rs", code: "INR", decimals: 2, locale: "en-IN", position: "prefix" },
  AED: { symbol: "AED", code: "AED", decimals: 2, locale: "ar-AE", position: "prefix" },
  GBP: { symbol: "£", code: "GBP", decimals: 2, locale: "en-GB", position: "prefix" },
  SGD: { symbol: "S$", code: "SGD", decimals: 2, locale: "en-SG", position: "prefix" },
};

// Usage: formatCurrency(50000, society.currency)
// -> "Rs 50,000.00" | "AED 50,000.00" | "£50,000.00" | "S$50,000.00"
```

### Timezone Management

- Each society stores its timezone (e.g., `Asia/Kolkata`, `Asia/Dubai`)
- All timestamps stored as UTC in database
- Display times converted to society timezone
- Cron jobs (fee reminders, recurring expenses) run relative to society timezone
- Notification scheduling respects society timezone (no 3 AM messages)

### Acceptance Criteria

- [ ] Society creation allows selecting country; market config auto-applied
- [ ] Currency displays correctly per society (INR, AED, GBP, SGD) in all screens
- [ ] Country-specific terminology applied across all UI labels and notifications
- [ ] UAE societies default to Arabic with RTL layout
- [ ] UK societies use GBP with UK date format (DD/MM/YYYY)
- [ ] Singapore societies use SGD with SGD formatting
- [ ] Tax calculations apply correct rate per country (GST 18%, VAT 5%/20%, GST 9%)
- [ ] Timezone stored per society; all displayed times converted correctly
- [ ] ID format follows country-specific pattern
- [ ] Integration readiness stubs present for DLD, Companies House, BCA
- [ ] Country-specific payment gateway selection during society setup

---

## Task 8.4 — GDPR & International Compliance

### Overview

Implement comprehensive data privacy and compliance features to satisfy GDPR (EU/UK), PDPA (Singapore), and UAE data protection regulations. This goes beyond basic privacy to include full data lifecycle management.

### Backend

| Method   | Endpoint                                | Purpose                                       |
| -------- | --------------------------------------- | --------------------------------------------- |
| `POST`   | `/api/v1/compliance/dpa`                | Generate Data Processing Agreement for tenant |
| `POST`   | `/api/v1/users/[id]/erasure-request`    | Right to Erasure request                      |
| `GET`    | `/api/v1/users/[id]/data-export`        | Data Portability export (JSON/CSV)            |
| `GET`    | `/api/v1/users/[id]/consents`           | List all consent records for user             |
| `POST`   | `/api/v1/users/[id]/consents`           | Record granular consent                       |
| `DELETE` | `/api/v1/users/[id]/consents/[purpose]` | Withdraw consent for specific purpose         |
| `GET`    | `/api/v1/compliance/residency-report`   | Data residency audit per region               |

### Data Processing Agreement (DPA)

- Auto-generated DPA document per tenant
- Covers: data controller vs processor roles, sub-processors, breach notification SLA
- Digital signature by tenant admin
- Version-tracked; re-sign required on material changes

### Right to Erasure

```
Erasure Request Flow:
  1. User submits erasure request via profile page
  2. System validates identity (re-authentication required)
  3. 72-hour cooling-off period (user can cancel)
  4. Admin notified of pending erasure
  5. System performs FULL deletion (not anonymization):
     - Personal data (name, email, phone, address)
     - Profile photo
     - Activity logs linked to user
     - Notification history
     - Payment records (retain transaction IDs for legal/tax)
     - RWAID card data
  6. Deletion receipt generated with timestamp
  7. User account deactivated; email hash retained to prevent re-registration abuse
  8. Audit log entry: "User [hash] data erased per request [REQ-ID]"
```

### Consent Management

Granular consent categories:

- `ESSENTIAL` — Account operation (cannot withdraw; required for service)
- `NOTIFICATIONS_SMS` — SMS notifications
- `NOTIFICATIONS_WHATSAPP` — WhatsApp notifications
- `NOTIFICATIONS_EMAIL` — Email communications
- `NOTIFICATIONS_PUSH` — Push notifications
- `ANALYTICS` — Usage analytics
- `MARKETING` — Marketing communications
- `DATA_SHARING` — Sharing with third-party integrations

### Cookie Consent Banner

```
+------------------------------------------------------------------+
| We use cookies to improve your experience.                        |
|                                                                   |
| [x] Essential (required)     [ ] Analytics     [ ] Marketing     |
|                                                                   |
|    [Accept All]   [Accept Selected]   [Reject Non-Essential]      |
|                                                                   |
| [Privacy Policy]  [Cookie Policy]                                 |
+------------------------------------------------------------------+
```

### Data Residency

| Region    | Data Location              | Provider        | Compliance             |
| --------- | -------------------------- | --------------- | ---------------------- |
| India     | Mumbai (ap-south-1)        | AWS India       | IT Act 2000            |
| UAE       | Bahrain (me-south-1)       | AWS Middle East | UAE Federal Decree-Law |
| UK        | London (eu-west-2)         | AWS UK          | GDPR + UK DPA 2018     |
| Singapore | Singapore (ap-southeast-1) | AWS Singapore   | PDPA                   |

- Society data stored in region matching society's country
- Cross-region data transfer requires explicit consent
- Data residency audit report available for Enterprise tenants

### Acceptance Criteria

- [ ] DPA auto-generated per tenant with correct legal entity details; digital signature captured
- [ ] Right to Erasure: request submitted, 72-hour cooling-off, full deletion executed, receipt generated
- [ ] Erasure deletes all personal data; retains only anonymized transaction IDs for legal compliance
- [ ] Data portability: user downloads complete personal data in JSON and CSV formats
- [ ] Consent management: granular per-purpose consent; withdrawal takes effect within 24 hours
- [ ] Cookie consent banner shown on first visit; preferences saved; non-essential cookies blocked until consent
- [ ] Privacy by Design audit checklist completed and documented
- [ ] Data residency enforced per region; no cross-region data transfer without consent
- [ ] Compliance dashboard shows consent rates, erasure requests, and data residency status per society

---

## Task 8.5 — AI Anomaly Detection

### Overview

Implement an anomaly detection system that identifies unusual financial patterns, suspicious admin activity, and irregular fee behaviors. Start with rule-based detection and evolve toward ML-based scoring.

### Backend

| Method  | Endpoint                             | Purpose                                                |
| ------- | ------------------------------------ | ------------------------------------------------------ |
| `GET`   | `/api/v1/societies/[id]/anomalies`   | List detected anomalies for a society                  |
| `GET`   | `/api/v1/anomalies`                  | Super Admin: all anomalies across platform             |
| `PATCH` | `/api/v1/anomalies/[id]`             | Update anomaly status (dismiss, investigate, escalate) |
| `GET`   | `/api/v1/anomalies/stats`            | Anomaly statistics and trends                          |
| `POST`  | `/api/v1/anomalies/[id]/investigate` | Mark as under investigation with notes                 |

### Anomaly Categories

**1. Expense Anomalies**

- Amount outlier: expense > 2x the 6-month average for that category
- Frequency spike: more than 3 expenses in same category within 7 days
- New category spike: first expense in a category exceeds Rs 10,000
- Round number pattern: repeated exact round amounts (Rs 10,000 every month)

**2. Fee Pattern Anomalies**

- Sudden exemption: resident moved from PENDING to EXEMPTED without documented reason
- Bulk corrections: more than 5 fee adjustments in a single day
- Late reversal: payment marked PAID reversed after 30+ days
- Collection drop: month-over-month collection rate drops by >15%

**3. Admin Activity Anomalies**

- Mass deletion: more than 10 records deleted in 1 hour
- Unusual hours: admin actions between 11 PM and 5 AM
- Permission escalation: admin grants themselves elevated permissions
- Rapid-fire actions: more than 50 write operations in 10 minutes

### Anomaly Severity Scoring

```
LOW    (0-30)  — Informational; likely benign but worth noting
MEDIUM (31-70) — Requires review; could indicate error or minor issue
HIGH   (71-100) — Requires immediate attention; potential fraud or abuse
```

Scoring factors:

- Amount deviation from norm (higher = higher score)
- Frequency of similar anomalies (recurring = higher score)
- Admin role involved (higher role = higher score)
- Time of occurrence (unusual hours = higher score)
- Pattern match against known fraud signatures

### Rule-Based Detection (Phase 1)

```typescript
// Example rules (executed by cron job every 6 hours)
const ANOMALY_RULES = [
  {
    id: "EXPENSE_AMOUNT_OUTLIER",
    description: "Expense exceeds 2x 6-month category average",
    category: "EXPENSE",
    severity: (deviation: number) => (deviation > 5 ? "HIGH" : deviation > 2 ? "MEDIUM" : "LOW"),
    query: `SELECT * FROM expenses WHERE amount > 2 * (
      SELECT AVG(amount) FROM expenses
      WHERE category = $1 AND created_at > NOW() - INTERVAL '6 months'
    )`,
  },
  {
    id: "ADMIN_MASS_DELETE",
    description: "More than 10 deletions in 1 hour by single admin",
    category: "ADMIN_ACTIVITY",
    severity: () => "HIGH",
    query: `SELECT admin_id, COUNT(*) FROM audit_log
      WHERE action = 'DELETE' AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY admin_id HAVING COUNT(*) > 10`,
  },
  // ... additional rules
];
```

### ML Evolution Roadmap

```
Phase 8a (Now):  Rule-based detection with configurable thresholds
Phase 8b (Later): Statistical models (Z-score, IQR) per society
Phase 8c (Future): Trained ML model on anonymized cross-society data
                   Features: amount, category, frequency, time, admin role
                   Model: Isolation Forest or Autoencoder for unsupervised detection
```

### UI Screen: Anomaly Detection Dashboard

```
+------------------------------------------------------------------+
|  [Sidebar]  |  Anomaly Detection                                  |
|             |-----------------------------------------------------+
|  Dashboard  |                                                     |
|  Anomalies<-|  Summary (Last 30 Days)                             |
|  Rules      |  +------------+  +------------+  +------------+    |
|  Settings   |  | HIGH    3  |  | MEDIUM  8  |  | LOW    22  |    |
|             |  | (!!!)      |  | (!!)       |  | (!)        |    |
|             |  +------------+  +------------+  +------------+    |
|             |                                                     |
|             |  High Severity (Requires Attention)                 |
|             |  +--------------------------------------------------+
|             |  | [!!!] Mass Deletion Detected          2h ago    |
|             |  | Admin: Rajesh Sharma deleted 14 fee records     |
|             |  | in 45 minutes. Severity: 85/100                |
|             |  |   [Investigate]  [Dismiss]  [Escalate]         |
|             |  +------------------------------------------------+
|             |  | [!!!] Expense Amount Outlier          5h ago    |
|             |  | Infrastructure: Rs 1,50,000 (avg: Rs 25,000)   |
|             |  | 6x above 6-month average. Severity: 92/100    |
|             |  |   [Investigate]  [Dismiss]  [Escalate]         |
|             |  +------------------------------------------------+
|             |  | [!!!] Unusual Admin Activity          8h ago    |
|             |  | Admin login and 38 write ops at 2:30 AM        |
|             |  | Severity: 78/100                               |
|             |  |   [Investigate]  [Dismiss]  [Escalate]         |
|             |  +--------------------------------------------------+
|             |                                                     |
|             |  Medium Severity                                    |
|             |  +--------------------------------------------------+
|             |  | [!!] Fee Collection Drop              1d ago    |
|             |  | March collection rate: 62% (prev: 81%)         |
|             |  | 19% drop month-over-month. Severity: 55/100   |
|             |  |   [Investigate]  [Dismiss]                     |
|             |  +--------------------------------------------------+
|             |                                                     |
|             |  Trend (6 Months)                                   |
|             |  Anomalies |                                        |
|             |     15 |        *                                    |
|             |     10 |  *           *                              |
|             |      5 |     *     *     *                           |
|             |      0 +--+--+--+--+--+--                           |
|             |        Oct Nov Dec Jan Feb Mar                      |
+-------------+-----------------------------------------------------+
```

### False Positive Management

- `DISMISS` — Mark as reviewed, not an issue; improves future scoring
- `INVESTIGATE` — Assign to admin for review; add investigation notes
- `ESCALATE` — Notify Super Admin; create audit trail entry
- `CONFIRM` — Confirm as genuine anomaly; trigger remediation workflow
- Dismissed anomalies reduce score for similar future detections
- Confirmed anomalies increase score for similar future detections

### Components to Build

- `AnomalyDashboard` — Summary cards, severity breakdown, trend chart
- `AnomalyCard` — Individual anomaly with details, severity badge, actions
- `AnomalyTimeline` — Chronological view of anomalies for a society
- `AnomalyTrendChart` — 6-month trend visualization
- `AnomalyRuleManager` — Admin UI to configure rule thresholds
- `InvestigationPanel` — Notes, status updates, assignment for investigations

### Acceptance Criteria

- [ ] Expense anomalies detected: amount outliers, frequency spikes, new category spikes
- [ ] Fee anomalies detected: sudden exemptions, bulk corrections, late reversals, collection drops
- [ ] Admin activity anomalies detected: mass deletions, unusual hours, permission escalation
- [ ] Severity scoring (0-100) calculated per anomaly with LOW/MEDIUM/HIGH classification
- [ ] Dashboard shows summary cards, high-severity alerts, and 6-month trend chart
- [ ] False positive management: dismiss, investigate, escalate actions all functional
- [ ] Dismissed anomalies reduce future scoring for similar patterns
- [ ] Cron job runs every 6 hours; new anomalies trigger real-time notification to Super Admin
- [ ] Rule thresholds configurable by Super Admin without code changes
- [ ] Anomaly data retained for 12 months for trend analysis

---

## Task 8.6 — API Marketplace & External Integrations

### Overview

Build a public API layer that allows third-party developers and services to integrate with RWA Connect. Includes API key management, rate limiting, webhook delivery, and integration stubs for utility boards and accounting software.

### Backend

| Method   | Endpoint                                 | Purpose                      |
| -------- | ---------------------------------------- | ---------------------------- |
| `POST`   | `/api/v1/developers/api-keys`            | Generate new API key         |
| `GET`    | `/api/v1/developers/api-keys`            | List all API keys for tenant |
| `DELETE` | `/api/v1/developers/api-keys/[id]`       | Revoke API key               |
| `GET`    | `/api/v1/developers/api-keys/[id]/usage` | Usage stats for key          |
| `POST`   | `/api/v1/webhooks`                       | Register webhook endpoint    |
| `GET`    | `/api/v1/webhooks`                       | List registered webhooks     |
| `DELETE` | `/api/v1/webhooks/[id]`                  | Remove webhook               |
| `GET`    | `/api/v1/webhooks/[id]/deliveries`       | Webhook delivery log         |

### Public API Endpoints (available via API key)

| Category  | Endpoint                                | Description                |
| --------- | --------------------------------------- | -------------------------- |
| Residents | `GET /api/v1/public/residents`          | List residents (paginated) |
| Residents | `GET /api/v1/public/residents/[id]`     | Resident detail            |
| Fees      | `GET /api/v1/public/fees`               | Fee ledger (paginated)     |
| Fees      | `POST /api/v1/public/fees/[id]/payment` | Record payment             |
| Expenses  | `GET /api/v1/public/expenses`           | Expense list               |
| Society   | `GET /api/v1/public/society`            | Society info and stats     |
| Reports   | `GET /api/v1/public/reports/collection` | Collection summary         |

### API Key Management

```typescript
interface APIKey {
  id: string;
  tenantId: string;
  name: string; // Descriptive name (e.g., "Tally Integration")
  key: string; // Shown once at creation; stored as hash
  prefix: string; // First 8 chars shown for identification (rwac_XXXXXXXX)
  permissions: string[]; // Scoped: ['residents:read', 'fees:read', 'fees:write']
  rateLimit: number; // Requests per minute (default: 60)
  dailyLimit: number; // Requests per day (default: 10,000)
  expiresAt: Date | null; // Optional expiry
  lastUsedAt: Date | null;
  createdAt: Date;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
}
```

### Rate Limiting

| Plan       | Rate Limit | Daily Limit | Webhook Endpoints |
| ---------- | ---------- | ----------- | ----------------- |
| Premium    | 60/min     | 10,000/day  | 5                 |
| Enterprise | 300/min    | 100,000/day | 25                |
| Custom     | Negotiable | Negotiable  | Unlimited         |

Rate limit headers on every response:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1709571600
```

### Integration Readiness

**Electricity Board**

- Bill fetch: `GET /api/v1/integrations/electricity/[consumerId]/bill`
- Payment: `POST /api/v1/integrations/electricity/[consumerId]/pay`
- Status: Stub ready; actual integration depends on state electricity board API availability

**Water Utility**

- Meter reading: `GET /api/v1/integrations/water/[meterId]/reading`
- Payment: `POST /api/v1/integrations/water/[meterId]/pay`
- Status: Stub ready; integration depends on municipal corporation API

**Property Tax**

- Due date: `GET /api/v1/integrations/property-tax/[propertyId]/due`
- Reminder: auto-notification 30 days before due date
- Status: Stub ready; integration depends on municipal records API

**Accounting Software**

- Tally: Export endpoint `GET /api/v1/integrations/tally/export` (XML format)
- QuickBooks: OAuth2 flow + sync endpoint `POST /api/v1/integrations/quickbooks/sync`
- Status: Tally export functional; QuickBooks via official API

### Webhook System

Supported events:

- `resident.registered` — New resident registration
- `resident.approved` — Registration approved by admin
- `fee.paid` — Fee payment recorded
- `fee.overdue` — Fee becomes overdue
- `expense.created` — New expense logged
- `anomaly.detected` — Anomaly detection triggered (high severity)
- `admin.changed` — Admin role changed

Webhook delivery:

- POST to registered URL with JSON payload
- HMAC-SHA256 signature in `X-RWAConnect-Signature` header
- Retry policy: 3 retries with exponential backoff (1m, 5m, 30m)
- Delivery log retained for 30 days

### UI Screen: API Management Console

```
+------------------------------------------------------------------+
|  [Sidebar]  |  API Management                                     |
|             |-----------------------------------------------------+
|  API Keys   |                                                     |
|  Webhooks<--|  API Keys                    [+ Generate New Key]   |
|  Docs       |  +--------------------------------------------------+
|  Usage      |  | Name              | Prefix     | Rate  | Status |
|             |  |--------------------|------------|-------|--------|
|             |  | Tally Integration  | rwac_8f2a  | 60/m  | Active |
|             |  | Mobile App         | rwac_3b1c  | 300/m | Active |
|             |  | Test Key           | rwac_9d4e  | 60/m  | Revoked|
|             |  +--------------------------------------------------+
|             |                                                     |
|             |  Webhooks                    [+ Register Webhook]   |
|             |  +--------------------------------------------------+
|             |  | URL                          | Events  | Status |
|             |  |------------------------------|---------|--------|
|             |  | https://tally.example/hook   | fee.*   | Active |
|             |  | https://slack.example/notify | anomaly | Active |
|             |  +--------------------------------------------------+
|             |                                                     |
|             |  Usage (Last 30 Days)                               |
|             |  Requests |                                         |
|             |    5000 |           ****                             |
|             |    3000 |     ****       ****                        |
|             |    1000 | ****               ****                    |
|             |       0 +--+--+--+--+--+--+--+--                    |
|             |         W1  W2  W3  W4                               |
|             |                                                     |
|             |  API Documentation                                  |
|             |  [View Swagger/OpenAPI Docs]                        |
|             |  [Download OpenAPI Spec (YAML)]                     |
+-------------+-----------------------------------------------------+
```

### Components to Build

- `APIKeyList` — Table of API keys with status, rate limits, actions
- `APIKeyCreateDialog` — Name, permissions, rate limit, expiry
- `WebhookManager` — Register/edit/delete webhooks, event selector
- `WebhookDeliveryLog` — Delivery history with status, retry count, payload
- `APIUsageChart` — Request volume over time per key
- `SwaggerUI` — Embedded OpenAPI documentation viewer

### Acceptance Criteria

- [ ] API key generation with scoped permissions; key shown once then stored as hash
- [ ] Rate limiting enforced per key; 429 response with Retry-After header when exceeded
- [ ] Public API endpoints return correct paginated data with API key authentication
- [ ] Webhook registration with event filtering; HMAC signature on all deliveries
- [ ] Webhook retry policy: 3 retries with exponential backoff; failed deliveries logged
- [ ] Integration stubs for electricity, water, property tax APIs present and documented
- [ ] Tally export generates valid XML; QuickBooks OAuth2 flow completes
- [ ] OpenAPI/Swagger documentation auto-generated from route definitions
- [ ] API usage dashboard shows request volume, error rates, and top endpoints
- [ ] API key revocation takes effect immediately; all subsequent requests return 401

---

## Task 8.7 — Builder White-Label

### Overview

Offer a pre-configured version of RWA Connect for real estate builders managing new construction projects. Builders manage multiple societies from a single dashboard, pre-register units before handover, and transition management to the elected RWA committee.

### Backend

| Method | Endpoint                                           | Purpose                          |
| ------ | -------------------------------------------------- | -------------------------------- |
| `POST` | `/api/v1/builders`                                 | Register builder account         |
| `GET`  | `/api/v1/builders/[id]/societies`                  | List builder's societies         |
| `POST` | `/api/v1/builders/[id]/societies`                  | Create society under builder     |
| `POST` | `/api/v1/builders/[id]/societies/[sid]/units/bulk` | Pre-register units in bulk       |
| `POST` | `/api/v1/builders/[id]/societies/[sid]/transition` | Initiate builder-to-RWA handover |
| `GET`  | `/api/v1/builders/[id]/analytics`                  | Builder dashboard analytics      |

### Builder Dashboard Features

- **Multi-society view**: See all projects (completed, under construction, handed over)
- **Pre-registration**: Bulk upload unit data (CSV) before residents move in
- **Handover workflow**: Structured transition from builder management to RWA committee
- **Analytics**: Occupancy rates, collection rates, maintenance costs per society

### Handover Transition Flow

```
BUILDER_MANAGED
  |
  +-- Builder initiates handover request
  |
  v
TRANSITION_PENDING
  |
  +-- RWA committee admin accepts handover
  +-- Builder transfers: documents, financial records, vendor contracts
  |
  v
TRANSITION_IN_PROGRESS
  |
  +-- Checklist completion:
  |   [ ] Financial records transferred
  |   [ ] Vendor contracts assigned
  |   [ ] Resident data verified
  |   [ ] Common area inventory documented
  |   [ ] Legal documents handed over
  |
  v
RWA_MANAGED
  |
  +-- Builder retains read-only access for 90 days
  +-- After 90 days: builder access fully revoked
```

### Pre-Registration CSV Format

```csv
unit_number,block,floor,area_sqft,bedrooms,owner_name,owner_phone,owner_email,possession_date
A-101,A,1,1200,2,Hemant Kumar,+919876543210,hemant@email.com,2026-06-15
A-102,A,1,1500,3,Rajesh Sharma,+919876543211,rajesh@email.com,2026-06-15
...
```

### Builder Analytics

- **Occupancy rate**: Units sold vs total units, units occupied vs sold
- **Collection rate**: Maintenance fee collection percentage per society
- **Expense ratio**: Monthly expenses vs monthly collection
- **Handover readiness**: Checklist completion percentage per society

### Acceptance Criteria

- [ ] Builder account created with multi-society management access
- [ ] Bulk unit pre-registration via CSV upload; validation errors reported per row
- [ ] Pre-registered units visible in society setup; residents can claim their unit during registration
- [ ] Handover transition: builder initiates, RWA admin accepts, checklist tracked to completion
- [ ] Builder retains read-only access for 90 days post-handover; then fully revoked
- [ ] Builder analytics dashboard shows occupancy, collection, and expense metrics per society
- [ ] Builder-branded societies use builder's branding until handover; then switch to RWA branding

---

## Task 8.8 — Advanced Analytics & Reporting

### Overview

Build an advanced analytics engine that computes society health scores, provides benchmarking against similar societies, generates trend analysis, and offers predictive forecasting for fee collection. Enterprise clients get an executive dashboard and custom report builder.

### Backend

| Method | Endpoint                                  | Purpose                               |
| ------ | ----------------------------------------- | ------------------------------------- |
| `GET`  | `/api/v1/societies/[id]/health-score`     | Computed health score (0-100)         |
| `GET`  | `/api/v1/societies/[id]/benchmarks`       | Benchmark against similar societies   |
| `GET`  | `/api/v1/societies/[id]/trends`           | Year-over-year trend data             |
| `GET`  | `/api/v1/societies/[id]/predictions`      | Predictive forecasting                |
| `GET`  | `/api/v1/enterprise/dashboard`            | Executive dashboard for multi-society |
| `POST` | `/api/v1/societies/[id]/reports/custom`   | Generate custom report                |
| `POST` | `/api/v1/societies/[id]/reports/schedule` | Schedule automated report             |

### Society Health Score (0-100)

```
Health Score Components:
  Collection Rate (40% weight)
    100% collected = 40 points
    80% collected  = 32 points
    <50% collected = 0 points

  Expense Ratio (20% weight)
    Expenses < 80% of collection = 20 points
    Expenses 80-100% = 10 points
    Expenses > 100% (deficit) = 0 points

  Resident Participation (15% weight)
    >80% active residents = 15 points
    50-80% active = 10 points
    <50% active = 0 points

  Admin Responsiveness (15% weight)
    Avg query response < 2 days = 15 points
    2-7 days = 10 points
    >7 days = 0 points

  Compliance Score (10% weight)
    All audits passed = 10 points
    Minor issues = 5 points
    Major issues = 0 points

Final Score: Sum of all components (0-100)
  90-100: Excellent
  70-89:  Good
  50-69:  Average
  30-49:  Needs Improvement
  0-29:   Critical
```

### Benchmarking

Compare a society against similar societies (same city, similar size, same plan tier):

- Collection rate percentile (e.g., "Better than 72% of similar societies")
- Average fee per unit comparison
- Expense distribution comparison
- Resident engagement comparison

### Predictive Analytics

- **Fee collection forecast**: Based on historical patterns, predict next 3 months' collection
- **Expense trend**: Predict upcoming expense spikes based on seasonal patterns
- **Resident churn**: Predict likelihood of tenant departures based on tenure and payment patterns
- **Budget planning**: Recommend optimal monthly fee based on expense trends and reserves

### Custom Report Builder

Users can build reports by selecting:

1. **Data source**: Residents, fees, expenses, festivals, visitors
2. **Columns**: Choose fields to include
3. **Filters**: Date range, status, category, etc.
4. **Grouping**: Group by category, month, block, floor
5. **Format**: PDF, Excel, CSV
6. **Schedule**: One-time or recurring (weekly, monthly, quarterly)

### Automated Report Schedule

- Monthly summary: auto-generated on 1st of each month, emailed to all admins
- Quarterly review: auto-generated, includes health score trend and benchmarks
- Annual report: comprehensive year-in-review with charts and recommendations

### Acceptance Criteria

- [ ] Society health score computed with 5 components; score displayed on admin dashboard
- [ ] Health score trend shown over 12 months with visual indicator (improving/declining)
- [ ] Benchmarking compares against similar societies; percentile ranks displayed
- [ ] Year-over-year trend analysis for collection, expenses, and participation
- [ ] Predictive analytics: 3-month collection forecast with confidence interval
- [ ] Executive dashboard for Enterprise clients: multi-society overview with health scores
- [ ] Custom report builder: select data source, columns, filters, grouping; generate PDF/Excel
- [ ] Automated report scheduling: monthly, quarterly, annual; email delivery to admin list
- [ ] Reports include charts (bar, line, pie) rendered as vector graphics in PDF
- [ ] Report generation queued asynchronously; notification sent when ready for download

---

## Phase 8 Database Additions

### New Tables

```sql
-- White-label tenants
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  plan            TEXT NOT NULL DEFAULT 'ENTERPRISE',
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  branding        JSONB NOT NULL DEFAULT '{}',
  custom_domain   TEXT UNIQUE,
  ssl_status      TEXT DEFAULT 'PENDING',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anomaly detection results
CREATE TABLE anomalies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id      UUID NOT NULL REFERENCES societies(id),
  category        TEXT NOT NULL,  -- EXPENSE, FEE_PATTERN, ADMIN_ACTIVITY
  rule_id         TEXT NOT NULL,
  severity_score  INT NOT NULL CHECK (severity_score BETWEEN 0 AND 100),
  severity_level  TEXT NOT NULL,  -- LOW, MEDIUM, HIGH
  description     TEXT NOT NULL,
  details         JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, INVESTIGATING, DISMISSED, ESCALATED, CONFIRMED
  assigned_to     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API keys
CREATE TABLE api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            TEXT NOT NULL,
  key_hash        TEXT NOT NULL,
  key_prefix      TEXT NOT NULL,
  permissions     TEXT[] NOT NULL DEFAULT '{}',
  rate_limit      INT NOT NULL DEFAULT 60,
  daily_limit     INT NOT NULL DEFAULT 10000,
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  expires_at      TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook registrations
CREATE TABLE webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  url             TEXT NOT NULL,
  events          TEXT[] NOT NULL,
  secret          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consent records
CREATE TABLE consent_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  purpose         TEXT NOT NULL,
  granted         BOOLEAN NOT NULL,
  ip_address      TEXT,
  user_agent      TEXT,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at    TIMESTAMPTZ
);

-- Builder accounts
CREATE TABLE builders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  company_name    TEXT NOT NULL,
  contact_email   TEXT NOT NULL,
  contact_phone   TEXT NOT NULL,
  branding        JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Builder-society mapping
CREATE TABLE builder_societies (
  builder_id      UUID NOT NULL REFERENCES builders(id),
  society_id      UUID NOT NULL REFERENCES societies(id),
  handover_status TEXT NOT NULL DEFAULT 'BUILDER_MANAGED',
  handover_date   TIMESTAMPTZ,
  readonly_until  TIMESTAMPTZ,
  PRIMARY KEY (builder_id, society_id)
);

-- Scheduled reports
CREATE TABLE scheduled_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id      UUID NOT NULL REFERENCES societies(id),
  report_type     TEXT NOT NULL,
  config          JSONB NOT NULL DEFAULT '{}',
  frequency       TEXT NOT NULL,  -- MONTHLY, QUARTERLY, ANNUAL
  recipients      TEXT[] NOT NULL,
  next_run_at     TIMESTAMPTZ NOT NULL,
  last_run_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Schema Changes to Existing Tables

```sql
-- Add to societies table
ALTER TABLE societies ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE societies ADD COLUMN country_code TEXT NOT NULL DEFAULT 'IN';
ALTER TABLE societies ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE societies ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE societies ADD COLUMN default_locale TEXT NOT NULL DEFAULT 'en';
ALTER TABLE societies ADD COLUMN market_config JSONB NOT NULL DEFAULT '{}';

-- Add to users table
ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'en';
ALTER TABLE users ADD COLUMN data_residency_region TEXT NOT NULL DEFAULT 'ap-south-1';
```

---

## Phase 8 Definition of Done

- [ ] White-label: tenant created, branding applied globally, custom domain with SSL active
- [ ] White-label: RWAID cards, emails, SMS, and WhatsApp all show client branding
- [ ] Multi-language: all 9 locales functional; RTL layout correct for Arabic
- [ ] Multi-language: fallback chain (user -> society -> English) works correctly
- [ ] International: UAE societies use AED + Arabic; UK uses GBP + en-GB; Singapore uses SGD + en-SG
- [ ] International: country-specific terminology applied across all UI and notifications
- [ ] International: timezone management correct; cron jobs run at local time
- [ ] GDPR: right to erasure with full deletion; data portability export functional
- [ ] GDPR: granular consent management; cookie banner with per-category control
- [ ] GDPR: data residency enforced per region (India, UAE, UK, Singapore)
- [ ] Anomaly detection: 3 categories (expense, fee, admin) with severity scoring
- [ ] Anomaly detection: dashboard with summary, alerts, trend chart, and action buttons
- [ ] Anomaly detection: false positive management improves future scoring
- [ ] API: keys generated with scoped permissions and rate limiting
- [ ] API: webhooks delivered with HMAC signature and retry policy
- [ ] API: OpenAPI/Swagger documentation available
- [ ] Builder: multi-society management, bulk pre-registration, handover workflow
- [ ] Analytics: society health score (0-100) with 5 weighted components
- [ ] Analytics: benchmarking against similar societies with percentile ranks
- [ ] Analytics: custom report builder with scheduling and email delivery
- [ ] All screens responsive; loading states and error states handled
- [ ] All API endpoints authenticated, rate-limited, and audit-logged
- [ ] Zero hardcoded strings; all UI text via next-intl translation keys
