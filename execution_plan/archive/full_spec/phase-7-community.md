# Full Spec Phase 7 — Community Features

**Duration**: ~4 weeks
**Goal**: Visitor management with QR verification, domestic help registry, AGM module, society notice board, vendor management, polls/surveys, and document repository.
**Depends on**: Phase 3 (Financial Advanced) + Phase 1 (Foundation)
**Source**: Full Spec v3.0 — Sections on Visitor Management, Community Features, Future Roadmap

---

## New Enums (Phase 7)

```sql
CREATE TYPE domestic_help_category AS ENUM ('MAID','DRIVER','COOK','GARDENER','NANNY','SECURITY_PERSONAL','LAUNDRY','OTHER');
CREATE TYPE domestic_help_status   AS ENUM ('ACTIVE','INACTIVE','BLACKLISTED');
CREATE TYPE notice_category        AS ENUM ('GENERAL','MAINTENANCE','EVENTS','EMERGENCY','RULES');
CREATE TYPE vendor_category        AS ENUM ('PLUMBER','ELECTRICIAN','CARPENTER','PAINTER','PEST_CONTROL','AC_REPAIR','APPLIANCE_REPAIR','CLEANING','GARDENING','OTHER');
CREATE TYPE vendor_status          AS ENUM ('APPROVED','PENDING_REVIEW','BLACKLISTED');
CREATE TYPE poll_type              AS ENUM ('SINGLE_CHOICE','MULTIPLE_CHOICE','YES_NO','RATING_SCALE');
CREATE TYPE poll_status            AS ENUM ('DRAFT','ACTIVE','CLOSED','CANCELLED');
CREATE TYPE agm_status             AS ENUM ('ANNOUNCED','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE rsvp_status            AS ENUM ('ATTENDING','NOT_ATTENDING','PROXY','NO_RESPONSE');
CREATE TYPE document_category      AS ENUM ('BYE_LAWS','MEETING_MINUTES','NOC_TEMPLATES','CIRCULARS','FINANCIAL_REPORTS','LEGAL','OTHER');
```

Existing enum used: `visitor_status` (EXPECTED, ARRIVED, DEPARTED, CANCELLED, NO_SHOW) from database-design.md.

---

## Task 7.1 — Visitor Pre-Registration & Management

### Backend

| Method     | Endpoint                                               | Purpose                                        |
| ---------- | ------------------------------------------------------ | ---------------------------------------------- |
| `POST`     | `/api/v1/societies/[id]/visitors`                      | Resident pre-registers visitor                 |
| `GET`      | `/api/v1/societies/[id]/visitors`                      | List visitors (filter: date, status, resident) |
| `POST`     | `/api/v1/societies/[id]/visitors/[visitorId]/verify`   | Security scans QR -> marks ARRIVED             |
| `POST`     | `/api/v1/societies/[id]/visitors/[visitorId]/checkout` | Mark DEPARTED                                  |
| `POST`     | `/api/v1/societies/[id]/visitors/walkin`               | Guard registers walk-in visitor                |
| `POST`     | `/api/v1/societies/[id]/visitors/delivery-pass`        | Short-duration delivery quick-pass             |
| `GET/POST` | `/api/v1/societies/[id]/visitors/frequent`             | List / save frequent visitor profiles          |

### QR & Visitor Code

- 6-digit alphanumeric `visitor_code` generated on pre-registration
- QR encodes `{ societyId, visitorCode, expectedDate }` and is shared via SMS/WhatsApp
- Auto-invalidates after `expected_departure` or end of `expected_date` + 2 hours

### Visitor Status Lifecycle

```
EXPECTED ──> ARRIVED ──> DEPARTED       EXPECTED ──> CANCELLED
                                        EXPECTED ──> NO_SHOW (auto, window expires)
```

### UI: Visitor Pre-Registration Form

```
+---------------------------------------------------------------+
| Pre-Register a Visitor                                        |
|---------------------------------------------------------------|
| Visitor Name *    [_______________________________]           |
| Phone Number *    [+91 ___________________________]           |
|                                                               |
| Purpose *   (o) Guest  ( ) Delivery  ( ) Service  ( ) Other  |
|                                                               |
| Expected Date *  [__/__/____]     Expected Time  [__:__ AM]   |
| Vehicle Number   [_______________]  (optional)                |
|                                                               |
| [x] Save as Frequent Visitor                                  |
|                                                               |
|                     [Cancel]  [Register & Generate QR]        |
+---------------------------------------------------------------+
```

### UI: Visitor QR Verification (Security Gate)

```
+---------------------------------------------------------------+
| GATE VERIFICATION                        Eden Estate Security |
|---------------------------------------------------------------|
| +-----------------------------------------------------------+|
| |          [ Camera / QR Scanner Active ]                    ||
| |      Point camera at visitor's QR code                     ||
| +-----------------------------------------------------------+|
| --- OR enter code manually ---                                |
| [______]  [Verify]                                            |
|                                                               |
| -- Verification Result --                                     |
| +-----------------------------------------------------------+|
| | [OK] VERIFIED                                              ||
| | Visitor: Rajesh Gupta     Host: Hemant Kumar (House #89)   ||
| | Purpose: Guest            Expected: 05 Mar, 10:00 AM       ||
| | Vehicle: HR-26-AB-1234                                     ||
| |            [Allow Entry]       [Deny & Notify Host]        ||
| +-----------------------------------------------------------+|
| [Register Walk-In]                  [Today's Expected: 12]    |
+---------------------------------------------------------------+
```

**Walk-in**: Guard enters name, phone, purpose, picks host -> host notified for approval.
**Delivery quick-pass**: 2-hour window, purpose = DELIVERY, company name required.

**Acceptance**:

- [ ] Resident pre-registers visitor; 6-digit code + QR generated
- [ ] QR shareable via WhatsApp/SMS link
- [ ] Security scans QR or enters code manually; sees visitor + host details
- [ ] Host notified on arrival (push + WhatsApp)
- [ ] Walk-in registration with host approval flow
- [ ] Delivery quick-pass creates 2-hour window
- [ ] Visitor log searchable by date, resident, purpose, status
- [ ] Frequent visitor profiles saved and reusable
- [ ] Auto-invalidation after visit window (status -> NO_SHOW)

---

## Task 7.2 — Domestic Help Registry

### Backend

| Method  | Endpoint                                | Purpose                                 |
| ------- | --------------------------------------- | --------------------------------------- |
| `POST`  | `.../domestic-help`                     | Register domestic help                  |
| `GET`   | `.../domestic-help`                     | List all (admin) or assigned (resident) |
| `PATCH` | `.../domestic-help/[helpId]`            | Update details                          |
| `POST`  | `.../domestic-help/[helpId]/deactivate` | Deactivate on departure                 |
| `POST`  | `.../domestic-help/[helpId]/entry`      | Record gate entry                       |
| `POST`  | `.../domestic-help/[helpId]/exit`       | Record gate exit                        |
| `GET`   | `.../domestic-help/[helpId]/attendance` | Monthly attendance report               |
| `POST`  | `.../domestic-help/[helpId]/assign`     | Assign to additional resident           |

### New Tables

- **`domestic_help`** — name, mobile, photo_url, id_proof_type/number, category, status, background_verified flag, deactivated_at
- **`domestic_help_assignments`** — help_id + resident_id + unit_id (many-to-many, shared help)
- **`domestic_help_attendance`** — help_id + entry_at + exit_at + recorded_by (guard)

**Acceptance**:

- [ ] Register domestic help with photo, phone, ID proof, category
- [ ] Assign help to one or more residents (shared help supported)
- [ ] Gate entry/exit recorded with timestamps
- [ ] Monthly attendance report (days present, average hours)
- [ ] Deactivation on departure with reason
- [ ] Background verification flag visible on profile
- [ ] Admin views all; resident sees only their assigned help
- [ ] Blacklisting prevents re-registration with same ID proof

---

## Task 7.3 — AGM (Annual General Meeting) Module

### Backend

| Method | Endpoint                      | Purpose                            |
| ------ | ----------------------------- | ---------------------------------- |
| `POST` | `.../agm`                     | Create AGM announcement            |
| `GET`  | `.../agm`                     | List all AGMs (past + upcoming)    |
| `POST` | `.../agm/[agmId]/rsvp`        | Resident RSVP                      |
| `POST` | `.../agm/[agmId]/proxy`       | Authorize proxy delegate           |
| `POST` | `.../agm/[agmId]/attendance`  | Mark attendance (admin, real-time) |
| `POST` | `.../agm/[agmId]/resolutions` | Record resolution with votes       |
| `POST` | `.../agm/[agmId]/minutes`     | Upload meeting minutes PDF         |
| `POST` | `.../agm/[agmId]/publish`     | Distribute minutes to all          |

### AGM Status Lifecycle

```
ANNOUNCED ──> IN_PROGRESS ──> COMPLETED (minutes uploaded + distributed)
    |
    +──> CANCELLED
```

### UI: AGM Announcement Screen

```
+---------------------------------------------------------------+
| Annual General Meeting                                        |
|---------------------------------------------------------------|
| ANNUAL GENERAL MEETING 2025-26                                |
| ============================================================= |
| Date:   Sunday, 15 March 2026                                |
| Time:   10:00 AM - 1:00 PM                                   |
| Venue:  Community Hall, Block A                               |
|                                                               |
| AGENDA                                                        |
| 1. Reading of previous AGM minutes                            |
| 2. Financial report 2025-26                                   |
| 3. Maintenance fee revision proposal                          |
| 4. Security upgrade discussion                                |
| 5. Election of new committee members                          |
| 6. Open floor                                                 |
|                                                               |
| RSVPs: 28 Attending | 5 Not Attending | 9 No Response        |
|                                                               |
| [RSVP: Attending]  [Authorize Proxy]                          |
|---------------------------------------------------------------|
| Past AGMs                                                     |
| Date         | Attended | Resolutions | Minutes               |
| 12 Mar 2025  | 34/42    | 5 passed    | [Download PDF]        |
| 18 Mar 2024  | 29/38    | 3 passed    | [Download PDF]        |
+---------------------------------------------------------------+
```

### Resolution Recording

Each resolution: title, proposed by, seconded by, votes for/against/abstain, status (PASSED/REJECTED).

**Acceptance**:

- [ ] Admin creates AGM with date, time, venue, and agenda items
- [ ] All residents notified of AGM announcement
- [ ] Residents RSVP (attending / not attending)
- [ ] Proxy authorization: delegate vote to named member
- [ ] Real-time attendance tracking during AGM
- [ ] Resolutions recorded with vote counts; PASSED/REJECTED by majority
- [ ] Minutes uploaded as PDF and distributed to all via notification
- [ ] Past AGM history with downloadable minutes

---

## Task 7.4 — Society Notice Board

### Backend

| Method   | Endpoint                          | Purpose                         |
| -------- | --------------------------------- | ------------------------------- |
| `POST`   | `.../notices`                     | Admin creates notice            |
| `GET`    | `.../notices`                     | List active notices (paginated) |
| `PATCH`  | `.../notices/[noticeId]`          | Update notice                   |
| `DELETE` | `.../notices/[noticeId]`          | Delete notice                   |
| `POST`   | `.../notices/[noticeId]/pin`      | Pin/unpin                       |
| `POST`   | `.../notices/[noticeId]/comments` | Add comment (if enabled)        |

Cron: Daily auto-archive notices past `expires_at`.

### UI: Society Notice Board

```
+---------------------------------------------------------------+
| Notice Board                              [+ Post Notice]     |
|---------------------------------------------------------------|
| [All] [General] [Maintenance] [Events] [Emergency] [Rules]   |
|                                                               |
| PINNED                                                        |
| +-----------------------------------------------------------+|
| | [!] WATER SUPPLY DISRUPTION               [Maintenance]    ||
| | Water supply disrupted on 6 Mar, 10 AM - 4 PM due to      ||
| | pipeline repair. Please store water accordingly.           ||
| | Posted: 04 Mar  |  Expires: 07 Mar  |  Comments: 3        ||
| +-----------------------------------------------------------+|
|                                                               |
| RECENT                                                        |
| +-----------------------------------------------------------+|
| | Holi Celebration Invite                     [Events]       ||
| | Join us on 14 Mar at community park. 4 PM onwards.         ||
| | Posted: 03 Mar  |  Expires: 15 Mar                         ||
| +-----------------------------------------------------------+|
| | Monthly Maintenance Update                  [General]      ||
| | February: garden trimming done, Block C lights repaired.   ||
| | Posted: 01 Mar                                             ||
| +-----------------------------------------------------------+|
|                                                               |
| [Show Archived Notices]                                       |
+---------------------------------------------------------------+
```

**Acceptance**:

- [ ] Admin creates notice with title, body (rich text), category, optional image
- [ ] Notice expiry date set; auto-archived after expiry
- [ ] Admin pins important notices (always at top)
- [ ] Category filter tabs work correctly
- [ ] Push notification on new notice; emergency bypasses quiet hours
- [ ] Optional comments per notice (admin enables/disables)
- [ ] Archived notices accessible but visually separated
- [ ] Residents view-only; only admins create/edit/delete

---

## Task 7.5 — Vendor Management

### Backend

| Method  | Endpoint                                 | Purpose                                 |
| ------- | ---------------------------------------- | --------------------------------------- |
| `POST`  | `.../vendors`                            | Admin registers vendor                  |
| `GET`   | `.../vendors`                            | List vendors (filter: category, rating) |
| `GET`   | `.../vendors/[vendorId]`                 | Detail with reviews                     |
| `PATCH` | `.../vendors/[vendorId]`                 | Update vendor info                      |
| `POST`  | `.../vendors/[vendorId]/blacklist`       | Blacklist vendor                        |
| `POST`  | `.../vendors/[vendorId]/reviews`         | Resident submits review                 |
| `POST`  | `.../vendors/[vendorId]/request-contact` | Resident requests contact               |

### New Tables

- **`vendors`** — name, mobile, category, status, description, availability, average_rating, total_reviews, blacklisted_at/reason
- **`vendor_reviews`** — vendor_id, resident_id, rating (1-5), review_text, service_date (unique per vendor+resident+date)
- **`vendor_service_history`** — vendor_id, resident_id, unit_id, service_description, service_date

**Acceptance**:

- [ ] Admin registers vendor with name, phone, category, availability
- [ ] Only admin-approved vendors visible to residents
- [ ] Residents submit rating (1-5 stars) and text review
- [ ] Average rating auto-calculated and displayed
- [ ] Category filter works (plumber, electrician, etc.)
- [ ] Vendor blacklisting hides vendor with recorded reason
- [ ] Service history tracked per vendor per resident

---

## Task 7.6 — Polls & Surveys

### Backend

| Method | Endpoint                     | Purpose                   |
| ------ | ---------------------------- | ------------------------- |
| `POST` | `.../polls`                  | Admin creates poll        |
| `GET`  | `.../polls`                  | List active + past polls  |
| `GET`  | `.../polls/[pollId]`         | Poll detail with results  |
| `POST` | `.../polls/[pollId]/respond` | Resident submits response |
| `POST` | `.../polls/[pollId]/close`   | Admin closes poll early   |
| `POST` | `.../polls/[pollId]/publish` | Publish results to all    |

Cron: Auto-close polls past `end_date`.

### New Tables

- **`polls`** — question, description, poll_type, is_anonymous, status, start_date, end_date, min_participation, results_published
- **`poll_options`** — poll_id, option_text, display_order, vote_count
- **`poll_responses`** — poll_id, option_id, resident_id, rating_value (for RATING_SCALE), unique per poll+resident+option

### UI: Poll Creation

```
+---------------------------------------------------------------+
| Create New Poll                                          [X]  |
|---------------------------------------------------------------|
| Question *  [Should we increase security guards from 2 to 3?]|
|                                                               |
| Description [This would increase maintenance by Rs 1,500/    |
|              unit. Currently 2 guards on 12-hour shifts.]     |
|                                                               |
| Poll Type *                                                   |
| (o) Yes/No  ( ) Single Choice  ( ) Multiple  ( ) Rating 1-5  |
|                                                               |
| Options (auto-filled for Yes/No):  1. Yes   2. No            |
|                                                               |
| Duration *   Start: [05/03/2026]     End: [12/03/2026]       |
| [ ] Anonymous responses                                       |
| Minimum participation: [50] % of residents                    |
|                                                               |
|              [Cancel]  [Save Draft]  [Publish Poll]           |
+---------------------------------------------------------------+
```

### UI: Poll Results

```
+---------------------------------------------------------------+
| Poll Results                                                  |
|---------------------------------------------------------------|
| Should we increase security guards from 2 to 3?              |
| Status: CLOSED  |  Ended: 12 Mar 2026                        |
| Participation: 35/42 residents (83%)  Threshold met: Yes      |
|                                                               |
| Yes:  24 votes (69%)  ================================---    |
| No:   11 votes (31%)  ===============---                      |
|                                                               |
| +-------------------+                                         |
| |   .-~~~-.         |  Outcome: PASSED (simple majority)      |
| |  / Yes   \        |                                         |
| | | 69%  No |       |  [Publish Results]  [Export PDF]        |
| |  \ 31%  /         |                                         |
| |   '-...-'         |                                         |
| +-------------------+                                         |
|                                                               |
| Active Polls                                                  |
| Park renovation design?  | 12/42 voted | 5d remaining        |
| Diwali budget approval?  | 30/42 voted | 2d remaining        |
+---------------------------------------------------------------+
```

**Acceptance**:

- [ ] Admin creates poll with question, type, options, duration
- [ ] Poll types: single choice, multiple choice, yes/no, rating scale
- [ ] Anonymous mode hides voter identity; named mode shows votes to admin
- [ ] Real-time results with bar chart + pie chart
- [ ] Minimum participation threshold tracked and displayed
- [ ] Auto-close on end date; admin can close early or cancel
- [ ] Results published to all residents via notification
- [ ] One vote per resident enforced (except multiple choice allows multi-select)

---

## Task 7.7 — Document Repository

### Backend

| Method   | Endpoint                         | Purpose                           |
| -------- | -------------------------------- | --------------------------------- |
| `POST`   | `.../documents`                  | Admin uploads document            |
| `GET`    | `.../documents`                  | List documents (filter: category) |
| `GET`    | `.../documents/[docId]/download` | Download file                     |
| `POST`   | `.../documents/[docId]/versions` | Upload new version                |
| `GET`    | `.../documents/[docId]/versions` | Version history                   |
| `DELETE` | `.../documents/[docId]`          | Admin deletes                     |
| `GET`    | `.../documents/search?q=...`     | Full-text search                  |

### New Table

**`documents`** — title, description, category, file_url, file_name, file_size, mime_type, version, uploaded_by, is_latest, parent_document_id (for version chain), search_text (TSVECTOR for FTS).

Categories: Bye-laws, Meeting Minutes, NOC Templates, Circulars, Financial Reports, Legal, Other.

**Acceptance**:

- [ ] Admin uploads documents (PDF, DOCX, XLSX, images) with title and category
- [ ] Documents organized by category with tab navigation
- [ ] All residents can view and download
- [ ] Version history maintained; latest version shown by default
- [ ] Full-text search across titles and descriptions
- [ ] File size limit enforced (max 10 MB per file)
- [ ] Admin-only upload/delete; residents view/download only

---

## Phase 7 Definition of Done

- [ ] Visitor pre-registration with QR generation, sharing, and gate verification
- [ ] Walk-in registration with host approval; delivery quick-pass (2-hour window)
- [ ] Visitor log searchable/filterable; frequent visitor profiles reusable
- [ ] Auto-invalidation of expired visitor codes (NO_SHOW)
- [ ] Domestic help registration with photo, ID, category; shared between residents
- [ ] Entry/exit tracking with monthly attendance reports
- [ ] AGM creation with agenda, RSVP, proxy authorization, real-time attendance
- [ ] Resolution recording with vote counts; minutes upload and distribution
- [ ] Notice board with categories, rich text, pinning, expiry, auto-archival
- [ ] Emergency notices bypass quiet hours; optional comments per notice
- [ ] Vendor registry with admin approval, ratings/reviews, blacklisting
- [ ] Polls: 4 types, anonymous/named, real-time charts, participation threshold
- [ ] Document repository with categories, versioning, and full-text search
- [ ] All 7 features accessible from unified sidebar navigation
- [ ] All UI screens responsive with loading, empty, and error states
- [ ] Push notifications for: visitor arrival, new notice, new poll, AGM, poll results
