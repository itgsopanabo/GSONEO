# GSONEO System Documentation

Technical documentation for the GSO information system. For installation and Docker commands, see the [README](../README.md).

## Contents

1. [Architecture](#1-architecture)
2. [Procurement and inventory workflow](#2-procurement-and-inventory-workflow)
3. [Roles and permissions](#3-roles-and-permissions)
4. [Dashboard](#4-dashboard)
5. [User accounts and passwords](#5-user-accounts-and-passwords)
6. [Audit trail](#6-audit-trail)
7. [Records registry](#7-records-registry)
8. [Generated documents (PDFs)](#8-generated-documents-pdfs)
9. [Frontend conventions](#9-frontend-conventions)
10. [How-to guides](#10-how-to-guides)
11. [Known issues](#11-known-issues)

---

## 1. Architecture

| Layer | Technology |
|---|---|
| Backend | Laravel 12 (PHP 8.2+) |
| Frontend | React 18 through Inertia.js 2, Tailwind CSS 3, built with Vite 7 |
| Charts | Recharts 3 |
| PDFs | barryvdh/laravel-dompdf |
| Routes in JavaScript | Ziggy (`route('name')`) |
| Database | MySQL 8 (container `laravel-db`) |
| Sessions and cache | Database drivers |

Requests flow through Laravel routes and controllers, which return Inertia responses. Pages live in `resources/js/Pages`, and every signed-in page uses `resources/js/Layouts/AuthenticatedLayout.jsx`.

Users sign in with their **employee ID** (`users.emp_id`), not an email address. `auth()->id()` therefore returns the employee ID, and columns such as `verify_by_emp_id` and `audit_log.user_id` store it.

### Dates and times

The system runs on **Philippine time**, set in two places that must agree:

| Setting | Where | Effect |
|---|---|---|
| `APP_TIMEZONE=Asia/Manila` | `.env`, read by `config/app.php` | What `now()` returns, so what gets written |
| `DB_TIMEZONE=+08:00` | `.env`, read by `config/database.php` | The session zone: how `TIMESTAMP` columns read back, and what `NOW()` returns inside a query |

The database container also runs `--default-time-zone=+08:00`, so the `mysql` CLI and any other client agree with the application.

**The two column types behave differently, which matters when writing migrations:**

- **`TIMESTAMP`** — every `created_at` / `updated_at`, `audit_log.created_at`, `records.archived_at`. MySQL stores these as UTC instants and converts them using the session zone, so they follow `DB_TIMEZONE` on their own.
- **`DATETIME`** — `verified_At`, `encoded_at`, `declined_At`, `cancelled_at`, `PO_Date`, `RIS_Date`, `SSMI_Date`, `released_at`. Timezone-blind: whatever wall clock was written is what comes back.

The app ran on UTC until September 2026, so everything stored before then read eight hours early. `2026_09_16_000500_shift_timestamps_to_manila` corrected it by adding eight hours to the `DATETIME` columns only — the `TIMESTAMP` ones were fixed by the session change alone, and shifting them too would have moved them eight hours past correct. Values at exactly `00:00:00` were left alone: those are dates recorded without a time, such as `PO_Date`, which the timeline prints as a bare date.

**Reaching the frontend**, the two types also differ, and both land correctly:

```json
{"created_at": "2026-09-16T05:31:48.000000Z",   // cast to a date: serialized as a UTC instant, converted by the browser
 "verified_At": "2026-09-16 13:32:11"}          // not cast: a plain local string, parsed as local by parseDate()
```

### Key directories

| Path | Purpose |
|---|---|
| `app/Http/Controllers` | Controllers per module |
| `app/Http/Middleware` | `EnsureUserHasPermission`, `EnsureUserIsActive`, `RequirePasswordChange`, `HandleInertiaRequests` |
| `app/Policies` | Model policies (`RecordsPolicy`) |
| `app/Services` | Domain logic shared by controllers, including `DocumentBranding` for PDF letterheads |
| `config/permissions.php` | Permission catalogue and each role's starting access |
| `config/documents.php` | Default letterhead, footer, watermark and signatories for generated PDFs |
| `config/dashboard.php` | Which dashboard widgets each permission unlocks |
| `config/Users.php` | Admin role, active status code, default password |
| `resources/js/Components/DasboardComponents` | Dashboard widgets |
| `resources/js/Components/Sidebar/navigation.js` | The sidebar menu and the permission behind each link |
| `resources/js/Utils/formatDate.js` | Shared date formatting |
| `resources/views/pdf` | Blade templates for generated PDFs; `partials/` holds the shared letterhead, footer and watermark |
| `docs/` | This documentation |
| `docs/erd/` | Generated entity relationship diagram (see [Generate the ERD](#generate-the-erd)) |

---

## 2. Procurement and inventory workflow

A purchase request (PR) moves through statuses stored in `purchase_requests.status`. Once it reaches the purchase order stage, a row in `purchase_order` carries its own status. Labels and badge colors live in `resources/js/Constants/statusConfig.js`, and descriptions in the `status` table.

### Purchase request statuses

| Code | Meaning | Worked on by |
|---|---|---|
| 0 | Draft | PR Encoder (Drafts and Encoded) |
| 1 | Pending verification | PR Verifier |
| 100 (110–130) | Verified | Canvas Officer |
| 200 | Canvassing | Canvas Officer |
| 205 | Canvass printed | PO Officer |
| 210 | Awaiting PO | PO Officer |
| 230 | PO generated | Moves to inventory |
| 700 | Rejected | — |
| 800 | Cancelled | Administrator only (Request Monitoring) |

Statuses can also be changed by an administrator from Request Monitoring (see [Administrative repairs](#administrative-repairs-cancelling-and-changing-status)).

### Purchase order statuses

| Code | Meaning | Worked on by |
|---|---|---|
| 200, 210 | Awaiting PO number | PO Officer |
| 230 | Incoming delivery | Stock Custodian (Incoming) |
| 300 | For inspection | Encoder (IAR) |
| 400 | For RIS | Encoder (RIS) |
| 500 | For SSMI | Encoder (SSMI) |
| 550 | For release | Stock Custodian (Outgoing) |
| 600 | Completed | — |

### Generating an IAR

An order can have more than one IAR — a delivery may arrive in parts — but a second one is far more often a second click, so it has to be asked for:

- **The same invoice twice on one order is refused outright.** A unique index on `iar (PO_Number, invoice_number)` is the real guard; `IARController::generate` checks first so the user gets a sentence instead of a database error.
- **Any further IAR needs the "another delivery" tick** in the dialog, which the server requires as `additional`. Without it the request is refused even if the invoice is new.

Note that `generate()` validates `item_ids` but does not store them, so every IAR currently covers the whole order regardless of what was ticked in the item list.

### Releasing an order (Outgoing)

The last step of the pipeline, and the only one where goods leave the building, so it records more than a status:

| Column | Holds |
|---|---|
| `released_at` | When the hand-over happened |
| `released_by_emp_id` | The staff member who released it |
| `released_to` | Who collected the items — free text, because they usually have no account here |
| `released_to_department` | Pre-filled with the requesting department, editable |
| `release_remarks` | Anything worth noting: a partial pick-up, a damaged item |

`InventoryController::toRelease` refuses anything that is not a genuine release:

- the collector's name is required;
- the order must be at **For release (550)** — without this, any PO number could be posted from any stage straight to Completed, skipping inspection, the issue slip and the stock card;
- an **SSMI number must exist**, matching the condition `SSMIController::toOutgoing` applies on the way in.

The queue itself is `inventory.outgoings` (`/inventory/outgoings`). In `routes/web.php` its group is registered **before** the Incoming `Route::resource('inventory', ...)`: registered after it, the address is caught by `inventory/{inventory}` and answers 404 while looking for a PO called "outgoings".

The release is written to the audit trail, and the order disappears from the Outgoing queue because it is no longer at 550. There is no undo in the module: an order released by mistake is put back with **Change status** on Request Monitoring, which clears `released_at` on the way down.

### Stage durations on Request Monitoring

The monitoring page shows the pipeline in order — how long each hand-off takes on average, and the whole run end to end:

| Stage | Measured from | to |
|---|---|---|
| Created to verified | `purchase_requests.created_at` | `purchase_requests.verified_At` |
| Verified to PO | `verified_At` | `purchase_order.PO_Date` |
| PO to IAR | `PO_Date` | the **first** `iar.created_at` for that PO |
| IAR to RIS | first `iar.created_at` | `RIS_Date` |
| RIS to SSMI | `RIS_Date` | `SSMI_Date` |
| SSMI to released | `SSMI_Date` | `released_at` |
| **Created to completed** | `purchase_requests.created_at` | `released_at` |

Notes on reading them:

- **Canvassing sits inside "Verified to PO"**, because nothing records when canvassing starts or ends.
- **`released_at` was added in September 2026.** Orders released before then have no release timestamp and cannot be backfilled, so the last two rows only count orders released since.
- A stage counts a record only once **both** its ends exist, so a request still mid-flow doesn't drag an average down. `n=` on each row is how many records the figure is drawn from — treat a small `n` as an anecdote, not a measure.
- **Negative spans are discarded.** A backwards status change can leave a later timestamp before an earlier one; rather than averaging nonsense, those records are skipped for that stage. Moving an order below 600 also clears `released_at`, so a record sent back stops counting as completed.
- All of it is computed in one query in `RequestMonitoringController::stageAverages()`, from the constant `STAGES` — add a row there and it appears on the page.

### Administrative repairs: cancelling, and changing status

Two actions on **Request Monitoring** — from the kebab menu (⋮) at the end of each row, which also holds **View timeline**, or from the buttons on the timeline itself — both needing `procurement.override`, which only the Superadmin holds by default. On the row menu they stay listed when unavailable, showing the reason rather than disappearing. They live there because the Purchase Request and Purchase Order screens are filtered to the stages their officers work on, so neither can reach a request sitting at, say, For RIS. Both require a reason and are written to the audit trail.

#### Changing status

The repair tool for a record that went the wrong way — a delivery that reached SSMI when it belonged in Incoming. Rules live in `app/Services/ProcurementStatusChange.php`, and the screen offers exactly what the route allows, with a sentence against every option it cannot.

**Which record.** Up to 230 the status is the request's; from 230 on it is the order's. So each option names its record, and the request track is closed once the order has moved past 230 — changing it then alters nothing real and makes the list show a stage the record has left.

**A status is offered only when the record can support it**, so a move cannot strand it somewhere a module will never pick it up:

| Target | Needs |
|---|---|
| Request 0–205 | No purchase order (cancel the order first — that returns the request to canvassing) |
| Request 210 | A live purchase order |
| Request 230, order 230/300 | A PO number |
| Order 400 | An IAR |
| Order 500 | A RIS number |
| Order 550, 600 | An SSMI number |

**Going back voids the paperwork it reverses.** `RISController::generateRISNumber` and `SSMIController::generateNumber` both refuse to issue a number over an existing one, so a record sent back to Incoming with its RIS number intact would reach the RIS stage again and stop dead. Moving below a stage therefore clears that stage's number, date and actor, and the audit entry records what was voided. **IARs are kept**: a purchase order may legitimately have several (partial deliveries), and IAR generation has no such guard. The auto-numbering takes the highest issued number plus one, so a voided number is not normally reused — unless it was the highest.

Moving a record off 800 clears its cancellation trail; that is how a cancellation is reversed. Cancelled (800) and Rejected (700) are never offered as targets — those have their own actions.

#### Cancelling

Cancellation is an administrative act, not a workflow step: it takes a record out of the pipeline and keeps it. Nothing is deleted — the PR and PO numbers stay spent, and who cancelled it, when and why are stored on the record (`cancelled_by_emp_id`, `cancelled_at`, `cancellation_reason`).

The dialog offers two different decisions:

| Choice | Effect |
|---|---|
| **Cancel the whole request** | The request and its purchase order both go to 800. |
| **Cancel the purchase order only** | The order goes to 800 and the request returns to canvassing — 205 when canvass forms exist, otherwise 100 — so a new purchase order can be raised. For a supplier who withdrew, or an order raised against the wrong request. |

What each choice allows is decided in `app/Services/ProcurementCancellation.php`, which both the routes and the screens read, so a button never offers something the request would refuse:

- Completed (600), declined (700) and already-cancelled (800) records are left alone.
- **Order-only cancellation stops once a PO number has been issued.** `purchase_order.PR_Number` is unique, so a request holds exactly one order row; sending it back for another PO would either reuse the issued number or free it for a different order, and an issued number must stay spent. From there, only the whole request can be cancelled. Lifting this means allowing many orders per request — a schema change that also touches the monitoring, dashboard and report joins.
- Once the delivery has been inspected (300 and beyond) there is no canvassing stage to return to, so again only the whole request can be cancelled.

A cancellation is reversed with Change status: move the record off 800 and its cancellation trail is cleared.

### Canvass "To be opened on"

`canvasForms.CF_to_be_Open` is a text column. It holds either a date (`YYYY-MM-DD`) or the literal `ASAP`. The Print Canvas and Recanvass dialogs offer a "Specific date / ASAP" switch, and the server accepts either value.

---

## 3. Roles and permissions

Access is **permission-based**. Each user has one role (`users.role_id`), and each role has a set of permissions that an admin manages on **Utils → Roles & Permissions**.

### Tables

| Table | Columns |
|---|---|
| `role` | `id`, `role_name`, `section` |
| `permissions` | `id`, `name` (e.g. `pr.verify`), `label`, `group`, `description` |
| `permission_role` | `role_id`, `permission_id` |

`role_name` is **not unique**: "Section Head" exists in Procurement, Motor Pool, Inventory and Sales, and Records. Always identify a role by section and name, or by ID.

### Permission catalogue

| Group | Permission | Grants |
|---|---|---|
| Procurement | `pr.view` | Purchase Request Management list, PR PDFs |
| | `pr.create` | Create a PR from the list |
| | `pr.encode` | Drafts and Encoded module |
| | `pr.verify` | Verify or decline PRs |
| | `pr.canvass` | Canvas Form module |
| | `pr.po` | Purchase Order Management, PO numbers |
| Inventory | `inventory.incoming` | Incoming deliveries, send to IAR |
| | `inventory.iar` | Inspection and Acceptance Reports |
| | `inventory.ris` | Requisition and Issue Slips |
| | `inventory.ssmi` | SSMI numbers and documents |
| | `inventory.outgoing` | Outgoing releases |
| Records | `records.view` | Records registry (view, register, edit, archive) |
| | `records.view_restricted` | Records in restricted classes |
| | `record_classes.manage` | Record classes |
| Monitoring and reports | `monitoring.view` | Request monitoring |
| | `reports.custom` | Report builder |
| | `reports.sql` | SQL console |
| | `audit.view` | Audit trail |
| Dashboard | `dashboard.system` | System overview widgets |
| | `dashboard.procurement` | Procurement overview widgets |
| | `dashboard.inventory` | Inventory overview widgets |
| | `dashboard.analytics` | Dashboard split into Overview, Pipeline and Reports tabs |
| Administration | `users.manage` | User List |
| | `permissions.manage` | Roles & Permissions screen |
| | `procurement.override` | Cancel a request or order, and move either to another status |
| | `items.manage` | Items catalogue |
| | `documents.manage` | Document Branding and PDF Signatories: logos, letterhead, footer, watermark and signature names on generated PDFs |
| | `docs.view` | Docs page: this documentation and the ERD viewer |
| Motor Pool | `motorpool.view` | Motor Pool (module not built yet) |

The starting access for each role is defined under `defaults` in `config/permissions.php`. The Superadmin starts with every permission.

### How checks work

**Routes** use the `permission` middleware (`app/Http/Middleware/EnsureUserHasPermission.php`). Several permissions separated by commas mean *any one of them*:

```php
Route::middleware('permission:pr.verify')->group(function () { /* ... */ });

Route::post('purchase-requests/ocr', [PurchaseRequestController::class, 'ocr'])
    ->middleware('permission:pr.create,pr.encode');
```

A user without the permission gets **403**.

**PHP code** can ask the user directly, or go through Laravel's gate. `Gate::before` in `AppServiceProvider` grants any ability whose name is a permission the user holds:

```php
$user->hasPermission('pr.verify');
$user->hasAnyPermission(['inventory.incoming', 'inventory.outgoing']);
$user->can('pr.verify');          // same result through the gate
```

For any other ability name, `Gate::before` returns `null`, so policies such as `RecordsPolicy` still decide.

**The frontend** receives the signed-in user's permission names as `auth.permissions`, shared by `HandleInertiaRequests`. The sidebar shows each link only when the user holds the matching permission:

```jsx
const permissions = auth.permissions ?? [];
const can = (permission) => permissions.includes(permission);
```

Hiding a link is only a convenience. The route middleware is what actually enforces access.

### Caching

`Role::permissionNames()` caches each role's permission names forever under `role:{id}:permissions`. The Roles & Permissions screen and `PermissionSeeder` clear that key whenever a role's permissions change. If you change `permission_role` directly in the database, clear the cache yourself:

```bash
docker compose exec app php artisan cache:clear
```

### Roles & Permissions screen

Route `permissions.index` (`/roles-permissions`), which requires `permissions.manage`.

- Roles appear grouped by section with their user counts, and permissions appear grouped with descriptions.
- Changes apply to every user with that role on their next page load.
- You cannot remove `permissions.manage` or `users.manage` from **your own** role (`protected_on_own_role` in the config), so an admin can't lock themselves out.
- Every save writes a `permissions_updated` audit entry listing the permissions added and removed.

### Seeding

```bash
docker compose exec app php artisan db:seed --class=PermissionSeeder
```

The seeder adds any new permissions from the catalogue. It gives `defaults` **only to roles that have no permissions yet**, so changes made on the screen survive a re-seed. The one exception is a role whose default is `'*'` (the Superadmin): it also receives any permission the seeder creates in that run.

---

## 4. Dashboard

`DashboardController` builds the page from `config/dashboard.php`, and `resources/js/Pages/Dashboard.jsx` renders it through the widget registry (`Components/DasboardComponents/Registry.jsx`).

### Widget rules

Each entry in `widgets` maps a widget key to the permission it needs:

```php
'welcome'     => null,                                             // everyone
'monthlyTrend'=> ['dashboard.procurement', 'dashboard.inventory'], // any of these
'verifyQueue' => ['permission' => 'pr.verify', 'unless' => 'dashboard.procurement'],
```

`unless` hides a task list from someone who already has the overview, so section heads see charts instead of every work queue. Widgets listed in `hide_when_empty` are dropped when they have no data. Only the widgets a user may see are queried.

### Tabs

Holders of **`dashboard.analytics`** — the Superadmin and the Department Head by default — read the dashboard as analytics, split into three tabs:

| Tab | Holds |
|---|---|
| Overview | The headline numbers: welcome, clock, stat tiles |
| Pipeline | Where work is sitting: PR and PO pipelines, and the work queues |
| Reports | Breakdowns and trends: monthly trend, department chart, recent requests, recent activity |

Everyone else gets the single page they have now, which suits a screen that is mostly "what is waiting on me today".

Which tab a widget belongs to is `widget_tabs` in `config/dashboard.php`; anything unlisted falls to the first tab. A tab with no visible widgets is dropped, and if only one tab is left the page renders flat — so nobody sees a tab strip with nothing to switch to. The active tab lives in the address (`#pipeline`), so a refresh or a shared link opens the same view.

Granting the tabs to another role needs no code change — tick `dashboard.analytics` for it on **Utils → Roles & Permissions**.

### Widgets

| Key | Shows |
|---|---|
| `welcome`, `clock` | Greeting, role, current time |
| `stats` | Counter tiles for the user's permissions; each links to its module |
| `monthlyTrend` | Line chart: PRs filed and POs opened per month, last 12 months |
| `prPipeline`, `poPipeline` | PRs or POs per workflow stage |
| `deptChart` | Requests by department (top 7, the rest folded into "Other") |
| `recentActivity` | Latest audit entries, page views excluded |
| `draftQueue`, `verifyQueue`, `canvassQueue`, `poQueue` | PRs waiting at that step, longest-waiting first |
| `incomingQueue`, `outgoingQueue`, `iarQueue`, `risQueue`, `ssmiQueue` | POs waiting at that step |
| `disposalQueue` | Records eligible for disposal now or within 90 days |
| `recentPrs` | Latest purchase requests |
| `comingSoon` | Placeholder for Motor Pool |

Half-width widgets pair up side by side. A half-width widget with no partner stretches to full width.

### Chart colors

- **Single-hue bar charts:** blue `#2a78d6` in light mode, `#3987e5` in dark mode.
- **Trend lines:** requests are always blue and orders always orange (`#eb6834` / `#d95926`).
- **Validation:** these colors passed contrast and color-blindness checks against white and gray-800 cards.
- **Rule:** keep a color tied to its series, never to its position.

---

## 5. User accounts and passwords

The User List (`users.index`) requires `users.manage`.

| Action | Where | Notes |
|---|---|---|
| Add user | **Add user** dialog on the list | Employee ID must be unique. The account gets a one-time password, shown once. |
| Change status | Dropdown on list or detail page | You can't deactivate yourself. Inactive users are signed out on their next request. |
| Change role | Detail page → Role | Confirmation shows from/to. You can't change your own role. Logged as `role_changed`. |
| Issue one-time password | **Issue one-time password** on the list, or detail page | See below. You can't reset your own here; use the profile page. |
| Delete | List or detail page | Refused if the user has related records; set them inactive instead. |

### One-time passwords

There is no shared default password. Every new or reset account gets its own random **one-time password**. An admin never types or chooses it.

- **Made by the server:** `User::issueTemporaryPassword()` makes 12 random characters without look-alikes (no `0/O`, `1/l/I`) and saves only the hash.
- **Shown once:** the password goes to the admin in the session flash (`flash.temporary_password`). `TemporaryPasswordModal` shows it with a **Copy** button. After **Done** or the next page load, nobody can see it again. Give it to the user in person or through a channel only they can read.
- **Expires:** it works for `USER_TEMP_PASSWORD_HOURS` hours (default 72, in `config/Users.php`). The time is stored in `users.temporary_password_expires_at`; `NULL` means the user chose their own password.
- **Issuing a new one:** the old password stops working right away. A new remember token is set, so an old "keep me signed in" cookie can't bring the previous login back.
- **Sign them out:** on by default. It deletes the user's sessions.
- **From the console:** when no admin can sign in (a new install, or a locked admin), run `php artisan user:one-time-password {emp_id}` on the server. It prints the password once and signs the user out.
- **Audit:** `created` (user) or `password_reset`, without the password. A console reset has an empty `user_id`.

### First sign-in on a one-time password

Anyone signed in on a one-time password:
- sees a **"Set up a new password"** dialog on every page that can't be closed; the only choices are save or sign out;
- cannot save, change or delete anything until they do: `RequirePasswordChange` middleware refuses every non-GET request except `password.first-change` and `logout`;
- must choose a password of at least 8 characters that is not the one-time password.

Saving clears `temporary_password_expires_at` and is logged as `password_changed`.

If the one-time password expires first, sign-in is refused with "Your one-time password has expired." A session left open past the expiry is signed out on its next request. An admin then issues a new one.

### Sign-in protection

`LoginRequest` handles every sign-in.

- **One message for every failure:** an unknown employee ID and a wrong password both show "The employee ID or password is incorrect." The form can't be used to find out which employee IDs have accounts. `Auth::attempt` also takes the same time for both.
- **Limit per employee ID:** 5 failed attempts per minute for one ID from one IP address.
- **Limit per IP address:** 20 failed attempts in 10 minutes from one IP address, across all employee IDs. This stops one password being tried against many IDs. A successful sign-in does not reset this count. Staff behind one shared IP address share this limit.
- **After the password is correct:** inactive accounts and expired one-time passwords are refused and signed back out. These messages appear only after a correct password, so they reveal nothing to a guesser.

### Moving from the old default password

Migration `2026_10_27_000000_replace_default_password_with_one_time_passwords` adds `temporary_password_expires_at`. It also finds every account still on the old shared default (`USER_DEFAULT_PASSWORD`, or `gso123`) and **locks** it: the password becomes a random one nobody knows, and the user is signed out. Their employee IDs are written to the log as a warning ("Accounts still on the old default password were locked"). Issue each of them a one-time password. If one of them is the only admin, use the console command.

### Registration

Self-registration is **disabled**; the `/register` routes are removed. Accounts are created only by an admin.

---

## 6. Audit trail

Entries live in `audit_log` (`AuditLog` model): `user_id` (employee ID), `action`, `auditable_type`, `auditable_id`, `description`, `old_values`, `new_values`, `ip_address`, `user_agent`, `created_at`.

The **Audit Trail** page (`audit-logs.index`, requires `audit.view`):

- **Filters:** they apply automatically as they change. Search waits for a pause in typing. Search matches the description, action, record type or ID, and the user's name or employee ID. There's also an action dropdown and From/Until dates.
- **Grouping:** entries are grouped by day, and each row shows its date and time.
- **Pages:** page links keep the active filters.

Passwords are never written to `old_values` or `new_values`.

### Actions recorded by this system

| Action | Written by |
|---|---|
| `created`, `updated`, `verified`, `Canvassing`, `PO Proceeding`, `Generate RIS Number` | Procurement and inventory controllers |
| `viewed`, `viewed_index` | Page views (hidden from the dashboard's activity list) |
| `password_reset`, `role_changed`, `created` (user) | `UserController`; `password_reset` also from `php artisan user:one-time-password` |
| `password_changed` | `RequiredPasswordChangeController` |
| `permissions_updated` | `RolePermissionController` |
| `document_branding_updated` | `DocumentSettingController`; the description names the settings changed, and `old_values` / `new_values` hold their before and after |
| `document_signatories_updated` | `DocumentSettingController`; the description names the signature blocks changed |

---

## 7. Records registry

Routes require `records.view`. `RecordsPolicy` (`app/Policies/RecordsPolicy.php`) adds a rule per record:

| Ability | Allowed when |
|---|---|
| `view` | User has `records.view`, and the record's class isn't restricted *or* the user has `records.view_restricted` |
| `update` (edit, archive, restore) | Same as `view` |
| `create` | Same rule applied to the chosen class; also checked when an edit moves a record to another class |

This matches `Records::scopeVisibleTo`, so a record hidden from the list can't be opened or changed by typing its web address. An archived record must be restored before it can be edited.

Base controllers don't include Laravel's `AuthorizesRequests` trait, so call `Gate::authorize()` instead of `$this->authorize()`.

---

## 8. Generated documents (PDFs)

PDFs are rendered on the server by dompdf from the Blade templates in `resources/views/pdf`:

| Document | Template | Controller method |
|---|---|---|
| Purchase Request | `purchase-request.blade.php` | `PurchaseRequestController::exportPdf` |
| Canvass Form | `canvas-form.blade.php` | `CanvasFromController::streamCanvasForms` |
| Inspection and Acceptance Report | `inspection-acceptance-report.blade.php` | `IARController::view` |
| SSMI | `ssmi.blade.php` | `SSMIController::document` |
| Branding sample | `branding-preview.blade.php` | `DocumentSettingController::preview` |

The Leave form (`leave.blade.php`) and the Locator Slip (`pls.blade.php`) are browser-printed HTML following fixed official layouts. They don't use the shared branding.

### Document branding

A system admin sets the letterhead once, on **Administration → Document Branding** (`document-settings.index`, `/document-settings`, requires `documents.manage`), and every PDF generated afterwards prints it. PDFs already printed are not affected.

| Part | Settings |
|---|---|
| Header | Left and right logo, logo height, header lines (e.g. Republic of the Philippines / Province / City), office name, motto under the right logo |
| Footer | Footer lines (address, phone, email) and page numbers, on every page |
| Design | Accent colour (office name, document title, header and footer lines), line under the header |
| Watermark | None, an image (its own upload, or the left logo), or diagonal text; strength 3–40% and size |

The screen has an approximate live preview. **Open a sample PDF** prints a two-page sample with the *saved* settings through the real templates, so save first to check a change. **Restore the original wording and design** puts back the values from `config/documents.php`; it doesn't touch the logos.

**Storage.** Settings are key/value rows in `document_settings`, read through `App\Services\DocumentBranding`, which falls back to `config('documents.defaults')` for any key never saved and caches the rest under `document-branding`. Saving clears the cache. Logos are stored on the **local disk** in `storage/app/private/branding/`, not in the database — back that folder up with the database (see the deployment guide). Replacing or removing a logo deletes the old file.

**Uploads** are PNG or JPEG up to 2 MB. SVG is refused: dompdf renders it unreliably and it can carry script. A transparent PNG of about 300 px square prints sharply without bloating each PDF, because the image is embedded in every document.

**Every save** writes a `document_branding_updated` audit entry.

### Signatories

**Administration → PDF Signatories** (`document-settings.signatories`, `/document-settings/signatories`, same `documents.manage` permission, and a tab on the Document Branding screen) sets the name and position printed in each signature block:

| Document | Signature blocks |
|---|---|
| Purchase Request | Certified by (City Budget Office), Cash Availability, Approved by |
| Canvass Form | Very truly yours |
| Inspection and Acceptance Report | Inspected by, Received and accepted by |
| SSMI | Prepared by, Certified by, Posted in the SLC by/date |

- **An empty name prints a blank line** to sign by hand; the position still prints beneath it.
- **Names print as typed**, with titles and suffixes (`ENGR.`, `CPA`). Some templates also set them in capitals.
- **Signatures that belong to the record are not here:** the PR's "Requested by" (the requesting department) and the Canvass form's "Canvass By" (the canvasser) come from the record itself.
- **The Leave form and Locator Slip** keep their signatories in their own templates.

The slots and their defaults are listed under `signatories` in `config/documents.php`, and saved values live in one JSON row, `document_settings.signatories`. `DocumentBranding::signatories()` merges the two and returns `document => [label, slots => slot => [label, name, position]]`. Templates read `$signatories['ssmi']['slots']['prepared_by']['name']`, usually through a local `$sig`. Every save writes a `document_signatories_updated` audit entry listing the blocks that changed, with their old and new values.

To add a signature block: add the slot to the document in the config, then print it in the template. It appears on the screen with its default.

### How the templates use it

`AppServiceProvider` shares `$branding` (`DocumentBranding::forPdf()`) with every `pdf.*` view, so controllers pass nothing extra. Logos go to dompdf as `data:` URIs, which needs no `storage:link` and no remote fetching.

Each template includes three partials:

```blade
<head>
    <style>/* the document's own styles */</style>
    @include('pdf.partials.branding-styles', ['pageBottom' => 48])   {{-- after the document's styles --}}
</head>
<body>
@include('pdf.partials.foreground')                                  {{-- footer and watermark: first thing in <body> --}}

@include('pdf.partials.letterhead', ['documentTitle' => 'Purchase Request', 'class' => 'pr-letterhead'])
```

| Partial | Notes |
|---|---|
| `branding-styles` | Must come after the document's own `<style>`. When there is a footer it widens the bottom page margin to fit; `pageBottom` is the document's own bottom margin in px, kept when larger. |
| `foreground` | Must be the **first thing in `<body>`**: dompdf repeats `position: fixed` elements only from the page where they first appear. The watermark sits *over* the content (`z-index`), faint enough to read through, because several templates paint white backgrounds that would hide anything beneath. |
| `letterhead` | `documentTitle` (optional) prints under the office name. `class` lets a template frame it, as the PR and SSMI do with their borders. |

When a template relies on `:first-child` (the Canvass form breaks pages before every sheet but the first), wrap its repeated blocks in their own container so the footer and watermark don't take the first-child slot.

---

## 9. Frontend conventions

### Dates

Use `resources/js/Utils/formatDate.js`; don't call `toLocaleDateString()` directly.

| Function | Example output |
|---|---|
| `formatDate(value)` | `Sept. 12, 2026` |
| `formatDateTime(value)` | `Sept. 12, 2026, 2:05 PM` |
| `formatDateTime(value, { dateOnlyAtMidnight: true })` | Drops the time when it's exactly midnight |
| `formatMonth('2026-09')` | `Sept. 2026` (or `Sept.` with `{ year: false }`) |
| `formatMonthDay(value)` | `Sept. 12` |
| `formatTime(value)` | `2:05 PM` |
| `toDateInputValue(value)` | `2026-09-12` for inputs |

Month abbreviations: Jan., Feb., Mar., Apr., May, June, July, Aug., Sept., Oct., Nov., Dec. Date-only strings (`2026-09-12`) are parsed as local dates, so they never shift a day across time zones.

For date **inputs**, use `resources/js/Components/DateInput.jsx`. It displays the formatted date, opens the browser's calendar, and emits the usual `YYYY-MM-DD` value.

```jsx
<DateInput value={form.from} onChange={(e) => setFrom(e.target.value)} />
```

### Other shared pieces

| Component | Use |
|---|---|
| `Components/Users/AddUserModal.jsx`, `SetPasswordModal.jsx` | User management dialogs |
| `Components/RequiredPasswordChangeModal.jsx` | Forced password change, mounted in the layout |
| `Components/DasboardComponents/DashboardCard.jsx` | Frame for dashboard widgets |
| `Constants/statusConfig.js` | Status labels and badge styles |

Import paths are case-sensitive in the Linux containers. Match the real file names, for example `@/Constants/statusConfig.js` and `DasboardComponents/Registry`.

---

## 10. How-to guides

### Add a permission

1. Add it to `catalogue` in `config/permissions.php`, and to any role under `defaults` that should start with it.
2. Run `php artisan db:seed --class=PermissionSeeder`. It appears on the Roles & Permissions screen; assign it to existing roles there.
3. Protect the routes: `->middleware('permission:your.permission')`.
4. Give the menu link `permission: 'your.permission'` in `resources/js/Components/Sidebar/navigation.js`.

A permission that must reach a role which already has access won't get there from `defaults` (the seeder only fills empty roles). Grant it in a migration instead, as `2026_09_16_000400_grant_analytics_dashboard_to_department_head` and `2026_09_23_000000_create_document_settings_table` do.

### Add a module page

1. Create the controller and the page in `resources/js/Pages/...`, using `AuthenticatedLayout`.
2. Register routes inside the `auth` group in `routes/web.php`, under a `permission:` middleware. Register fixed paths such as `/inventory/outgoings` **before** a `Route::resource` on the same prefix; otherwise its `{parameter}` route answers first.
3. Add the link to `resources/js/Components/Sidebar/navigation.js` with its `route`, `active` pattern and `permission`.
4. Write audit entries for changes (`AuditLog::create([...])` or the `App\LogsAudit` trait), never storing secrets.

### Add a dashboard widget

1. Return its data from `DashboardController::dataFor()` under a new key.
2. Add the key and its permission rule to `widgets` in `config/dashboard.php`, in display order.
3. Register the component, span and props in `Registry.jsx`. Reuse `WorkQueue`, `StageBars` or `DashboardCard` where possible.

### Generate the ERD

`app/Console/Commands/GenerateErd.php` reads the live database schema and writes the diagram to `docs/erd/`:

```bash
docker compose exec app php artisan erd:generate
```

| File | Contents |
|---|---|
| `docs/erd/erd.html` | The viewer shown on the Docs page: pan (drag), zoom (scroll or buttons), Fit, table search with column details, click a table to jump to it, SVG/PNG download. It loads Mermaid from the app's own build (`resources/js/erd-mermaid.js`, served at `/docs/erd/mermaid.js`), so it needs no internet — but it is opened through the app (Docs → ERD), not from disk, and `npm run build` must have run. |
| `docs/erd/erd.md` | Mermaid diagram, a relationships table, and a column reference for every table. GitHub and VS Code render the diagram. |
| `docs/erd/erd.mmd` | The Mermaid diagram alone, for [mermaid.live](https://mermaid.live) or other Mermaid tools |

| Option | Effect |
|---|---|
| `--only=users,role` | Only these tables |
| `--all` | Include framework tables (`sessions`, `cache`, `jobs`, `migrations`, …), which are left out by default |
| `--path=docs/erd` | Output folder, relative to the project root |

- **Lines:** they come from **database foreign keys** only. Columns joined in code without a constraint, such as `audit_log.user_id` or `canvasForms.pr_number`, appear in their tables but get no line.
- **Keys:** `PK`, `FK` and `UK` (unique) are marked on each column.
- **Cardinality:** `||` means exactly one, `|o` zero or one, `o{` zero or many. A foreign key that is also unique draws as one-to-one.

Run it again after any migration. The files are overwritten and carry the generation time.

### Docs page in the app

**Docs** in the sidebar (`docs.index`, `/docs`, requires `docs.view`) shows two tabs:

- **Documentation:** `docs/DOCUMENTATION.md` rendered as HTML. Edit the file and reload; nothing needs rebuilding. Links to other repository files, such as the README, show as plain text.
- **ERD:** the generated `docs/erd/erd.html`, embedded from `docs.erd` (`/docs/erd`), with an **Open full screen** link. The `#erd` address fragment opens this tab directly.

Regenerating the ERD stays a command-line task, because the web server cannot write to `docs/`.

### Change how long one-time passwords last

Set `USER_TEMP_PASSWORD_HOURS` in `.env` (default 72), then run `php artisan config:clear` if the config is cached. It applies to passwords issued after the change.

### Let someone in when no admin can sign in

```bash
php artisan user:one-time-password 12345
```

Prints a one-time password for employee 12345 and signs them out everywhere. In Docker, prefix it with `docker compose exec app`.

---

## 11. Known issues

- **Canvas `CF_bac_date` in PDFs:** `canvas-form.blade.php` runs `Carbon::parse()` on the BAC date. An empty value prints today's date.
- **PDF dates:** server-generated PDFs still use their own date formats, such as `2026-09-12` on canvass forms, not the UI's `Sept. 12, 2026`.
- **PDF page numbers:** the footer prints "Page 2" but not "of 5". dompdf has no CSS counter for the total page count.
- **Leave form and Locator Slip signatories** are still written into `leave.blade.php` and `pls.blade.php`, not set from PDF Signatories.
- **Department values:** `requester_department` holds a department name on the Purchase Request page but a department code in Encoding, so the same department can appear twice in charts.
- **Motor Pool:** its roles exist, but the module isn't built; those users see a placeholder dashboard card.
- **Docket Management:** the sidebar link under Records points to `#`.
