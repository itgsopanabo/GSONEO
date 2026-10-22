# GSONEO API Plan

> **Plan only. Nothing here is built yet.**
> It adapts the API preparation note from my notes vault to this codebase. Items marked **(A#)** are assumptions to confirm; they are listed in [Assumptions to confirm](#assumptions-to-confirm). For how the system works today, see [DOCUMENTATION.md](DOCUMENTATION.md). For the server, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Contents

1. [Why an API, and what to build first](#1-why-an-api-and-what-to-build-first)
2. [What the API must respect](#2-what-the-api-must-respect)
3. [Endpoints](#3-endpoints)
4. [Rate limits](#4-rate-limits)
5. [File uploads](#5-file-uploads)
6. [Authentication and authorization](#6-authentication-and-authorization)
7. [API conventions](#7-api-conventions)
8. [Audit trail](#8-audit-trail)
9. [Data privacy (RA 10173)](#9-data-privacy-ra-10173)
10. [What stays hidden before award](#10-what-stays-hidden-before-award)
11. [Backups](#11-backups)
12. [Documentation and tests](#12-documentation-and-tests)
13. [Build order](#13-build-order)

---

## 1. Why an API, and what to build first

Today every route in `routes/web.php` returns an Inertia page. There is no `routes/api.php` and no Sanctum config, and the staff screens don't need an API.

| Client | Needs | Phase |
|---|---|---|
| CGSO request kiosk (lobby screen and department PCs) | Read-only status lookup by PR or PO number + department | 1 |
| Reports or other city systems | Read-only lists and timelines | 2, only when a real client asks |
| A mobile app or another system that writes | Write actions | 3, only when a real client exists |

**Rule 1: don't build the full staff API before a client needs it.** Every endpoint is more code to secure, test and keep in step with the screens.

**Rule 2: the API uses the same rules as the screens.** API controllers call the same services the web controllers use (`ProcurementStatusChange`, `ProcurementCancellation`, the number generators). Where a rule lives only in a web controller today, move it to `app/Services` first, then both the web and API controllers call it. There is never a second copy of a business rule.

The vault plan assumed PostgreSQL and Docker + Dokploy on a VPS. GSONEO runs MySQL 8 on one Windows server, reached over a VPN. **This plan follows GSONEO.** Moving to a VPS would be a separate decision; [DEPLOYMENT.md §2](DEPLOYMENT.md#2-why-a-single-server) explains the single-server choice.

---

## 2. What the API must respect

These are already decided in the code. The API follows them.

| Topic | Today | What it means for the API |
|---|---|---|
| Stack | Laravel 12, Inertia + React, MySQL 8. Sessions, cache and queue use the database | No Redis needed at first. Rate-limit counters live in the database cache, which is fine on one server |
| Server | On-premise: one Windows machine on the city's own servers, Docker Desktop, VPN only (`https://gsoneo.lgu.local`) | The API is VPN-only too. A kiosk or department PC must be on the VPN (decision 2) |
| Login | Employee ID (`users.emp_id`) + password, a session, and the `active` and `password.changed` middleware | The API login uses the same checks |
| Access | One role per user; permissions in `config/permissions.php`; `permission:` middleware | API routes use the same middleware and permission names. No new role system |
| Numbers | `PR-2026-0001`, `PO-2026-00001`, `CANVAS-000001`, RIS, SSMI: highest + 1 under `lockForUpdate` | API creates go through the same generators |
| Double IAR | Unique index on `iar (PO_Number, invoice_number)` + the `additional` flag | Keep both. The API answers 409 instead of an error page |
| Audit | `audit_log`, written by `AuditLog::create` or the `App\LogsAudit` trait | Every API change is logged the same way (section 8) |
| Uploads | PR OCR: JPG, PNG or PDF up to 1 MB. Branding logos: PNG or JPEG up to 2 MB, no SVG | New uploads follow the same style (section 5) |
| Time | Asia/Manila. `TIMESTAMP` and `DATETIME` columns read back differently | The API sends both as ISO 8601 with `+08:00` |
| Statuses | PR and PO codes ([DOCUMENTATION.md §2](DOCUMENTATION.md#2-procurement-and-inventory-workflow)), labels in `statusConfig.js` and the `status` table | The API sends the code **and** the label |

---

## 3. Endpoints

### 3.1 Lookup for the kiosk (phase 1)

**Where it lives (decision 1):** in this Laravel app, in `routes/api.php` under `/api/lookup/v1`, with its own database connection (`lookup`). That connection uses a MySQL user that can only `SELECT` from one view, `v_request_status`. On one server, a separate service adds little, and the read-only user still means a bug in the lookup can't write or read other tables.

| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/api/lookup/v1/departments` | Department list for the dropdown | Kiosk, department PCs |
| POST | `/api/lookup/v1/status` | One request by PR or PO number + department → status card | Kiosk, department PCs |
| GET | `/api/lookup/v1/steps` | Every step, each with a plain-English meaning | Kiosk, department PCs |
| GET | `/api/lookup/v1/health` | Is the lookup up? | Kiosk |

Why `POST` for a read: the number and department stay out of the URL, so they don't land in nginx logs or the kiosk's browser history.

```json
POST /api/lookup/v1/status
{ "number": "PR-2026-0001", "department": "CHO" }

200 OK
{
  "data": {
    "pr_number": "PR-2026-0001",
    "po_number": null,
    "department": "City Health Office",
    "step": "canvassing",
    "step_label": "Canvass in progress",
    "step_no": 4,
    "total_steps": 9,
    "step_since": "2026-10-18T14:05:00+08:00",
    "as_of": "2026-10-19T09:30:00+08:00"
  }
}
```

- A wrong number and a wrong department give the **same** 404: "No request found for this number and department." Guessing gets no hint.
- `PR-…` and `PO-…` numbers both find the same request.
- **Fix first:** DOCUMENTATION.md §11 lists that `requester_department` holds a department *name* on the Purchase Request page but a *code* in Encoding. The lookup matches on department, so this has to be one value (the code) before phase 1. Otherwise real requests answer "not found".

Draft kiosk steps **(A1)**:

| Code | GSONEO meaning | Kiosk shows |
|---|---|---|
| PR 0 | Draft | Received, being encoded |
| PR 1 | Pending verification | Received, being checked by CGSO |
| PR 100–130 | Verified | Verified, waiting for canvass |
| PR 200, 205 | Canvassing, canvass printed | Canvass in progress |
| PR 210 | Awaiting PO | Preparing the purchase order |
| PR/PO 230 | PO generated, incoming delivery | PO issued, waiting for delivery |
| PO 300 | For inspection | Delivered, under inspection |
| PO 400, 500 | For RIS, for SSMI | Accepted, preparing the issue papers |
| PO 550 | For release | Ready for release |
| PO 600 | Completed | Released to your department |
| 700 | Rejected | Declined. Please contact CGSO |
| 800 | Cancelled | Cancelled. Please contact CGSO |

**The view `v_request_status`** holds only: PR number, PO number, department code and name, kiosk step, step date, and, from 230 on, the supplier (`PO_Supplier`) **(A2)**. Nothing else.

**Cache:** Laravel `Cache` with the key `lookup:{number}:{department}`, kept for 2–5 minutes **(A3)**. The services that change a status (`ProcurementStatusChange`, the number generators, `toRelease`) call `Cache::forget` for that request. Because it is the same app, no cache-clear endpoint is needed.

### 3.2 Staff endpoints (phase 2 reads, phase 3 writes)

All of these sit under `/api/v1`, behind `auth:sanctum`, `active`, `password.changed` and the same `permission:` middleware as the web route they mirror.

**Auth**

| Method | Path | Purpose | Permission | Reuses |
|---|---|---|---|---|
| POST | `/auth/login` | Employee ID + password → session (or a token for a named client) | guest | `AuthenticatedSessionController` |
| POST | `/auth/logout` | End the session or revoke the token | signed in | same |
| GET | `/auth/me` | User, role, permission names | signed in | what `HandleInertiaRequests` shares |

**Purchase requests and canvass**

| Method | Path | Purpose | Permission | Reuses |
|---|---|---|---|---|
| GET | `/purchase-requests` | List; filter by status, department, dates | `pr.view` | `PurchaseRequestController@index` |
| GET | `/purchase-requests/{id}` | One PR with its items | `pr.view` | `@show` |
| GET | `/purchase-requests/{id}/timeline` | Status timeline | `monitoring.view` | `RequestMonitoringController@show` |
| POST | `/purchase-requests` | Create a PR | `pr.create` | `@store` |
| GET, POST, PATCH | `/drafts`, `/drafts/{id}` | Encoder drafts | `pr.encode` | `EncodingController` |
| POST | `/purchase-requests/{id}/verify` | Verify | `pr.verify` | `@verify` |
| POST | `/purchase-requests/{id}/decline` | Decline (700) | `pr.verify` | `@decline` |
| POST | `/purchase-requests/{id}/canvass` | Start canvassing (200) | `pr.canvass` | `CanvasFromController@proceedCanvassing` |
| POST | `/purchase-requests/{id}/canvass-forms` | Print canvass forms (205) | `pr.canvass` | `CanvasFromController@store` |
| POST | `/purchase-requests/{id}/cancel` | Cancel (800), with reason | `procurement.override` | `@cancel` |
| POST | `/purchase-requests/{id}/status` | Administrative status change, with reason | `procurement.override` | `@changeStatus` |

**Purchase orders**

| Method | Path | Purpose | Permission | Reuses |
|---|---|---|---|---|
| GET | `/purchase-orders` | List | `pr.po` | `PurchaseOrderController@index` |
| GET | `/purchase-orders/{id}` | One PO | `pr.po` | `@show` |
| POST | `/purchase-orders/{id}/po-number` | Give the PO number | `pr.po` | `@generatePONumber` |
| POST | `/purchase-orders/{id}/cancel` | Cancel the order only, with reason | `procurement.override` | `@cancel` |
| POST | `/purchase-orders/{id}/status` | Administrative status change, with reason | `procurement.override` | `@changeStatus` |

**Inventory: delivery, inspection, issue, release**

| Method | Path | Purpose | Permission | Reuses |
|---|---|---|---|---|
| GET | `/deliveries/incoming` | Orders waiting for delivery (230) | `inventory.incoming` | `InventoryController@index` |
| POST | `/purchase-orders/{id}/send-to-inspection` | 230 → 300 | `inventory.incoming` | `@toIAR` |
| GET | `/iars` | IAR list | `inventory.iar` | `IARController@index` |
| POST | `/purchase-orders/{id}/iars` | Make an IAR (invoice no.; `additional: true` for another delivery) | `inventory.iar` | `@generate` |
| GET | `/iars/{id}/pdf` | IAR PDF | `inventory.iar` | `@view` |
| POST | `/purchase-orders/{id}/ris-number` | Give the RIS number | `inventory.ris` | `RISController@generateRISNumber` |
| POST | `/purchase-orders/{id}/ssmi-number` | Give the SSMI number | `inventory.ssmi` | `SSMIController@generateNumber` |
| POST | `/purchase-orders/{id}/send-to-release` | → 550 | `inventory.ssmi` | `@toOutgoing` |
| GET | `/releases` | Orders waiting for release (550) | `inventory.outgoing` | `InventoryController@outgoing` |
| POST | `/purchase-orders/{id}/release` | → 600; collector's name required | `inventory.outgoing` | `@toRelease` |
| GET, POST, PATCH | `/missing-tags…` | Missing tracker | `MissingTrackerController::PERMISSIONS` | `MissingTrackerController` |

**Items, records, monitoring, audit, users**

| Method | Path | Purpose | Permission | Reuses |
|---|---|---|---|---|
| GET | `/items` | Search the item catalogue | `pr.create`, `pr.encode` or `items.manage` **(A4)** | `ItemsController@index` |
| POST, PATCH | `/items`, `/items/{id}` | Add or edit items | `items.manage` | `ItemsController` |
| GET | `/records` | Records registry (with `RecordsPolicy`) | `records.view` | `RecordsController@index` |
| POST, PATCH | `/records`, `/records/{id}` | Register or edit | `records.view` | `RecordsController` |
| PATCH | `/records/{id}/archive`, `/unarchive` | Archive or restore | `records.view` | same |
| GET | `/monitoring` | Requests in the pipeline | `monitoring.view` | `RequestMonitoringController@index` |
| GET | `/monitoring/stage-averages` | Average time per stage | `monitoring.view` | `stageAverages()` |
| GET | `/audit-logs` | Audit trail | `audit.view` | `AuditLogController@index` |
| GET, POST | `/users` | List or add users | `users.manage` | `UserController` |
| PATCH | `/users/{id}/status`, `/users/{id}/role` | Change status or role | `users.manage` | same |

**Never in the API:** the SQL console (`reports.sql`), raw report-builder queries, profile deletion, Roles & Permissions, and Document Branding. These stay web-only.

**Not in GSONEO yet** (they were in the vault plan): a suppliers table (`PO_Supplier` is free text today) and property records (PAR / ICS). Each is a separate decision, not part of the API work.

---

## 4. Rate limits

Two layers:
1. **nginx** `limit_req`: a rough wall per IP (for example 20 requests/second, burst 40) in front of PHP.
2. **Laravel** `RateLimiter::for(...)` in `AppServiceProvider`, per client type (table below).

On the VPN, every device has its own address, so per-IP limits really mean "per device".

| Client | Limit | Counted by | Why |
|---|---|---|---|
| Staff API: reads | 120 / minute | user | One screen makes 5–10 calls. Room for fast work, but it stops a loop or a script. |
| Staff API: writes and actions | 30 / minute | user | Nobody completes a real form every 2 seconds. |
| PDFs and reports | 10 / minute | user | dompdf is CPU-heavy, and everything runs on one desktop-class server. |
| Login | 5 tries / minute | employee ID + IP | Stops password guessing. `LoginRequest::ensureIsNotRateLimited()` already does this; the API login reuses `LoginRequest`. |
| Kiosk device | 20 lookups / minute, 1,000 / day | kiosk token | One person types a number every 15–30 seconds at most. The day cap catches a script. |
| Lookup from department PCs (no login) | 30 / minute | IP | A real user checks a few requests. |
| Lookup "not found" | 5 per 10 minutes → 15-minute pause | IP or kiosk token | Numbers run in order (`PR-2026-0001`, `0002`, …). Many misses in a row means someone is guessing. This is the main guard. |
| File upload | 10 / minute, 100 / day | user | Each file is virus-scanned (section 5). |

These are starting points. Measure in the first month and adjust **(A6)**. Database-cache counters are fine at this size. Move them to Redis only if the traffic grows.

When a limit is hit, Laravel already sends `Retry-After` and the `X-RateLimit-*` headers. The API adds a JSON body:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 0
Content-Type: application/problem+json

{ "type": "https://gsoneo.lgu.local/errors/rate-limited", "title": "Too many requests",
  "status": 429, "code": "RATE_LIMITED", "detail": "Please wait 42 seconds and try again." }
```

Clients wait at least `Retry-After` seconds. The kiosk shows a friendly countdown, never an error code.

---

## 5. File uploads

Today GSONEO stores no scanned documents. The PR OCR reads a JPG, PNG or PDF of up to 1 MB, and only logos are kept. If GSONEO starts **keeping** scans, these are the starting limits **(A7)**:

| Document | Attached to | Formats | Max size | Why |
|---|---|---|---|---|
| Purchase request (signed) | PR | PDF | 10 MB | A 200–300 dpi scan is about 0.2–1 MB per page |
| Canvass forms and quotations | PR (canvass) | PDF | 20 MB | Can run to many pages |
| Purchase order (signed, with conforme) | PO | PDF | 10 MB | Same as PR |
| Delivery receipt or invoice | PO (delivery) | PDF, JPG, PNG | 10 MB | Often a phone photo at the door |
| IAR (signed) | IAR | PDF | 10 MB | Same as PR |
| Item photos | PO (delivery) | JPG, PNG, WebP | 8 MB each, 10 per record | Phone photos are 2–6 MB |

The OCR's 1 MB limit stays as it is. It is set for OCR speed, not for keeping files.

**Not allowed:** Word, Excel, ZIP, SVG, HTML, and anything else not listed. The same reasons as the SVG ban on logos: they can carry scripts or macros, or hide other files.

**Validation**, in this order: size → extension → real type from the file's bytes (Laravel's `mimes` rule does this) → PDF opens and has no password → images re-saved (this removes EXIF and GPS data) → new random name (UUID) → SHA-256 hash saved → virus scan.

**Storage:** the local disk, `storage/app/private/documents/{year}/{month}/{uuid}.{ext}`, next to `branding/`. It is never public. Downloads go through a controller that checks the permission for the parent record. After the record moves on, a file is never replaced: a correction is a new file, and the old one is marked void.

**Virus scan:**

```
upload → storage/app/private/quarantine (pending)
       → queued job → ClamAV container (clamd, internal Docker network)
            ├─ clean    → move to documents/ (clean) → can be downloaded
            └─ infected → stays in quarantine → audit entry + alert to the admin
```

- Add two services to `docker-compose.yaml`: `clamav` (official `clamav/clamav` image) and a `worker` running `php artisan queue:work`. The `database` queue works for this; compose has no worker today.
- ClamAV needs about 2–3 GB of RAM. With it, the server needs **16 GB**, not the 8 GB minimum in DEPLOYMENT.md §3.1 **(A8)**.
- If ClamAV is down, files wait in quarantine. Never skip the scan.

---

## 6. Authentication and authorization

**Staff**
- Run `php artisan install:api`. It adds `routes/api.php`, the Sanctum config and the `personal_access_tokens` table.
- Same-site clients (pages on `gsoneo.lgu.local`) use Sanctum's cookie sessions with CSRF. Any other client uses a Sanctum token whose abilities are permission names. Each token has an expiry and can be revoked.
- The same checks as the web: employee ID login, `active`, `password.changed`, `permission:`.
- Recommended: two-factor login for holders of `users.manage`, `permissions.manage` and `procurement.override`; a minimum password length of 12 instead of 8 **(A9)**.

**Kiosk**
- A "Kiosk" role with one new permission, `lookup.view`, and one user per kiosk device. Each device gets a Sanctum token with only the `lookup` ability. Revoking a token shuts that kiosk off.
- Department PCs use the lookup without logging in. The guards are the VPN, number + department, and the "not found" limit. Requesting departments usually have no GSONEO accounts (see `released_to` in DOCUMENTATION.md §2).

**Authorization**
- 403 when the permission is missing, as the web does today.
- 404 when a record is outside what the user may see (as `Records::scopeVisibleTo` does), so they can't tell it exists.
- Hiding a button is never the check. The middleware and policies are.

---

## 7. API conventions

**Versioning.** `/api/v1/…` for staff, `/api/lookup/v1/…` for the kiosk. They are versioned apart because the kiosk may update at a different time. Adding a field is not a breaking change; removing or renaming one is, and goes to `v2`.

**Pagination.** `paginate()` for lists (default 25, max 100) and `cursorPaginate()` for the audit trail, which grows fast because page views are logged too.

```json
{ "data": [ … ], "meta": { "page": 2, "per_page": 25, "total": 312, "last_page": 13 } }
```

**Filters.** Allowlisted per endpoint: `filter[status]`, `filter[department]`, `from`, `until` (the same names as the Audit Trail page), and `q` for search. `sort=-created_at`. An unknown filter gives 400.

**Formats.** Dates as ISO 8601 with `+08:00`. Statuses as `{ "status": 210, "status_label": "Awaiting PO" }`. Money as a string with 2 decimals (`"12500.00"`), never a float.

**Errors.** One format for every error: Problem Details (RFC 9457). Render it for `api/*` in `bootstrap/app.php` → `withExceptions`.

```json
{ "type": "https://gsoneo.lgu.local/errors/validation", "title": "Some fields are not valid",
  "status": 422, "code": "VALIDATION_FAILED",
  "errors": { "invoice_number": ["This invoice already has an IAR on this order."] } }
```

| Status | When |
|---|---|
| 400 | Bad filter or broken JSON |
| 401 | Not signed in, or the token expired |
| 403 | Signed in, but no permission |
| 404 | Not found, or not visible to you |
| 409 | Wrong status for this action (e.g. release when not at 550), a duplicate IAR invoice, or the same idempotency key still running |
| 412 | Someone else saved the record first |
| 422 | Validation failed |
| 429 | Rate limit |
| 500 | Server error. No stack trace |

**Idempotency (no double actions).** Writes accept an `Idempotency-Key: <uuid>` header. A middleware saves key + user + route + body hash + response in an `idempotency_keys` table for 24 hours:
- same key, same body → the saved response is returned;
- same key, different body → 422;
- same key still running → 409.

This covers PR create, verify, canvass, PO number, IAR, RIS, SSMI, release, cancel and status change. The database guards GSONEO already has stay as the last wall: `lockForUpdate` numbering, the unique IAR invoice index, and the status checks in `toRelease`.

**Edits.** Send `If-Match` with the record's `updated_at` (as an ETag). If someone saved first → 412, so two staff don't overwrite each other.

---

## 8. Audit trail

- API writes go to the same `audit_log`, in the same way as the web. Add a `channel` column (`web`, `api`, `kiosk`) so API activity can be filtered **(A10)**.
- Don't put kiosk lookups in `audit_log`. It already grows with page views. Use a small `lookup_log` table instead (time, number, department, result, IP or kiosk), kept for 90 days.
- Log token creation and revocation, and 429 lockouts.
- Make `audit_log` append-only: the app's MySQL user gets `INSERT` and `SELECT` on it, but no `UPDATE` or `DELETE`. Migrations then need their own user **(A11)**.
- As today, never log passwords, tokens or file contents.

---

## 9. Data privacy (RA 10173)

Personal data GSONEO holds: employee IDs and names (`users`), collectors' names (`released_to`), signatory names (document settings), supplier names that may be sole proprietors (`PO_Supplier`), and IP addresses and browsers in `audit_log`.

- **The kiosk shows none of it.** The view in section 3.1 has no person's name.
- Bring in the city's Data Protection Officer: lawful basis, Privacy Impact Assessment, and whether the system must be registered with the NPC **(A12)**.
- Put a short privacy notice on the login page and the kiosk.
- The SQL console (`reports.sql`) can read every personal field. Keep it Superadmin-only, log each query, and never expose it through the API **(A13)**.
- Encrypt the backups (section 11). Report a serious breach to the NPC within 72 hours.

---

## 10. What stays hidden before award

RA 12009 (New Government Procurement Act, 2024) replaced RA 9184. Confirm with the BAC Secretariat which rules apply and what may be shown **(A14)**.

GSONEO doesn't record an "award" step. Canvassing runs from 200 to 210, and the supplier first appears with the PO (`PO_Supplier`) at 230. So:

| Before 230 (PO generated) | From 230 |
|---|---|
| Kiosk and department PCs see only the step and its date | The supplier name may show **(A2)** |
| No canvass forms, quotations, suppliers or prices | Still no other quotations or prices |
| Canvass "To be opened on" date: hidden unless the BAC agrees **(A15)** | — |

This is enforced in the view, not only in the API code: before 230 the supplier column is `NULL`, so a bug can't leak it. Add a Pest test for it.

---

## 11. Backups

[DEPLOYMENT.md §10](DEPLOYMENT.md#10-backups) already covers backups. The API adds only:
- The new tables (`personal_access_tokens`, `idempotency_keys`, `lookup_log`) are in the database, so the existing backup covers them.
- A new `storage/app/private/documents/` folder must be backed up with the database, like `branding/`.
- Test a restore after the first API release.

---

## 12. Documentation and tests

- Use **Scramble** (`dedoc/scramble`) to build the OpenAPI spec from `routes/api.php` and the Form Requests. Show it behind `docs.view`, next to the Docs page.
- When the API is built, add an API section to DOCUMENTATION.md and keep this plan as its history.
- Write Pest feature tests for every endpoint: allowed, missing permission (403), not visible (404), wrong status (409), the rate limit (429), and "the lookup returns no supplier before 230".

---

## 13. Build order

| Phase | Work |
|---|---|
| 0. Prepare | Fix the department name/code issue. `php artisan install:api`. JSON error rendering. The `v_request_status` view and the read-only `lookup` MySQL user. |
| 1. Kiosk lookup | Lookup endpoints, rate limits, `lookup_log`, kiosk tokens, Pest tests, and the kiosk page. |
| 2. Read API | Staff `GET` endpoints, only when a real client needs them. |
| 3. Write API | Staff actions with idempotency, only when a real client needs them. |
| Later | Keeping scanned documents, with ClamAV and a worker (section 5). |

---

## Assumptions to confirm

| # | Assumption | Ask or check |
|---|---|---|
| A1 | The kiosk steps and their wording | CGSO staff |
| A2 | The kiosk may show the supplier from 230 on | BAC Secretariat |
| A3 | A status may be up to 2–5 minutes old on the kiosk | CGSO head |
| A4 | Who may search items through the API | CGSO head |
| A5 | ~~The login keeps a try limit~~ Confirmed: `LoginRequest` uses `RateLimiter` | Done |
| A6 | Rate-limit numbers | Real use in the first month |
| A7 | GSONEO will keep scanned documents, and these sizes fit the office scanner | CGSO head; test scans |
| A8 | The server can have 16 GB of RAM | City IT |
| A9 | Two-factor login and 12-character passwords for admin roles | CGSO head |
| A10 | A `channel` column on `audit_log` | My call |
| A11 | Separate MySQL users for the app and for migrations | My call; DEPLOYMENT.md update |
| A12 | Lawful basis and NPC registration | City DPO |
| A13 | Who holds `reports.sql`, and whether its queries are logged | Check the code; CGSO head |
| A14 | Which procurement rules apply (RA 12009 and its IRR, or RA 9184 for older procurements) | BAC Secretariat, city legal office |
| A15 | Whether the canvass opening date may be shown | BAC Secretariat |

## Decisions to make

1. **Where the lookup lives:** inside GSONEO with a read-only database connection (recommended), or as a separate service.
2. **Who can reach the lookup:** the VPN only, as today (the lobby kiosk then needs its own VPN profile), or the city network without the VPN, or the internet for phones. Each step outward needs more protection.
3. **What the kiosk shows before the PO (230):** confirm section 10 with the BAC Secretariat and the DPO, then build the view to match.
