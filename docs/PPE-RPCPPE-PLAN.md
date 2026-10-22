# GSONEO Property Plan: PPE register, RPCPPE and RPCSP

> **Plan only. Nothing here is built yet.**
> Items marked **(A#)** are assumptions to confirm; they are listed in [Assumptions to confirm](#assumptions-to-confirm). For how the system works today, see [DOCUMENTATION.md](DOCUMENTATION.md).

## Contents

1. [Goal and scope](#1-goal-and-scope)
2. [What GSONEO has today](#2-what-gsoneo-has-today)
3. [Data model](#3-data-model)
4. [Flow from IAR to PAR and ICS](#4-flow-from-iar-to-par-and-ics)
5. [Opening import](#5-opening-import)
6. [Count sessions](#6-count-sessions)
7. [Outputs: RPCPPE and RPCSP](#7-outputs-rpcppe-and-rpcsp)
8. [Permissions and roles](#8-permissions-and-roles)
9. [Audit, privacy and tests](#9-audit-privacy-and-tests)
10. [Build order](#10-build-order)

---

## 1. Goal and scope

**Goal:** GSONEO keeps the city's register of property and produces the yearly physical count reports for COA:

| Report | For | Compares |
|---|---|---|
| **RPCPPE**: Report on the Physical Count of Property, Plant and Equipment | PPE: unit value at or above the capitalization threshold | Quantity per property card against quantity per physical count |
| **RPCSP**: Report on the Physical Count of Semi-Expendable Property | Semi-expendable property: below the threshold, but durable | Same, per semi-expendable property card |

**Threshold:** ₱50,000 per unit (COA Circular 2022-004) **(A1)**. Ask Accounting how items bought under the old ₱15,000 threshold are classed today **(A2)**.

**In scope:** movable property, such as office, ICT and other equipment, furniture and fixtures, and motor vehicles.
**Out of scope for now:** land, buildings and infrastructure. Land titles already sit in the Records registry as restricted records **(A3)**.

**Rule:** the register is the property card. It is never edited directly. Every change is an event on the card (acquired, issued, transferred, returned, counted, disposed), so a card's history is always complete. This is the same idea as a stock card.

---

## 2. What GSONEO has today

| Exists | Where | Use for this plan |
|---|---|---|
| Delivered quantity per PR item | `iar_items` (`iar_id`, `purchase_request_item_id`, `quantity_received`) | Where new property comes from |
| Unit costs per PR item | `purchase_request_items.bidding_unit_cost`, `estimated_unit_cost` | Suggests PPE or semi-expendable |
| Fund source per order | `purchase_order.fund_source` | Fund cluster on the reports |
| Supplier, PO and delivery dates | `purchase_order` (`PO_Supplier`, `PO_Date`, `received_at`) and `iar.invoice_date` | Date acquired and the source of each property |
| Departments | `departments` (`Department_Code`, `Department_Name`) | Where property is, who holds it |
| Number generators | Highest + 1 under `lockForUpdate` | The same pattern for property, PAR and ICS numbers |
| PDF letterhead and signatories | `DocumentBranding`, `config/documents.php` | RPCPPE, RPCSP, PAR, ICS and property card PDFs |
| Audit trail | `audit_log`, `App\LogsAudit` | Every property event |

**Missing:**
- a property register, property numbers, PAR, ICS and property cards;
- a list of accountable officers (most employees have no GSONEO account);
- a way to tell a consumable from equipment: PR items are free text with no item type.

---

## 3. Data model

MySQL tables. Money is `decimal(15,2)`. Dates follow the `TIMESTAMP` / `DATETIME` rules in DOCUMENTATION.md §1.

### 3.1 Lookups

**`property_accounts`**: the "type of PPE" each report is grouped by.

| Column | Notes |
|---|---|
| `id` | |
| `code` | Account code from Accounting's chart of accounts **(A4)** |
| `name` | For example "ICT Equipment", "Furniture and Fixtures" |
| `kind` | `ppe` or `sep` (semi-expendable) |
| `active` | Retire, never delete |

**`accountable_officers`**: the people who sign a PAR or ICS. They don't need a GSONEO login.

| Column | Notes |
|---|---|
| `id` | |
| `employee_no` | City employee ID, nullable. Links to `users.emp_id` when the person has an account |
| `full_name`, `position` | As printed on forms |
| `department_code` | → `departments.Department_Code` |
| `active` | Set inactive when they leave or retire; their property must be transferred first |

### 3.2 The register (property cards)

**`properties`**: **one row per physical unit**, so each unit has its own property number, serial, QR label and history.

| Column | Notes |
|---|---|
| `id` | |
| `property_number` | Unique. Format to confirm **(A5)**, for example `2026-ICT-0001` |
| `kind` | `ppe` or `sep` |
| `property_account_id` | → `property_accounts` |
| `article`, `description` | Article (for example "Laptop") and full description |
| `brand_model`, `serial_number` | Nullable |
| `unit`, `unit_value` | Unit of measure and acquisition cost |
| `date_acquired` | |
| `fund_cluster` | From `purchase_order.fund_source`, or from the import |
| `source` | `iar`, `import`, `donation` or `transfer_in` |
| `po_number`, `iar_item_id` | Where it came from (nullable for imports) |
| `import_batch_id` | Nullable; the batch that brought it in |
| `status` | `untagged`, `in_stock`, `issued`, `for_disposal`, `disposed`, `lost` |
| `condition` | `serviceable`, `for_repair`, `unserviceable` |
| `officer_id`, `department_code`, `location` | Who holds it now and where it is. These are **set only by events**, never edited directly |
| `legacy_number` | Old property number or PAR/ICS number from before GSONEO |

**`property_events`**: the property card itself (append-only).

| Column | Notes |
|---|---|
| `property_id` | |
| `event` | `acquired`, `tagged`, `issued`, `transferred`, `returned`, `condition_changed`, `counted`, `for_disposal`, `disposed`, `lost` |
| `document_id` | → `property_documents` (the PAR, ICS, PTR… behind the event), nullable |
| `from_officer_id`, `to_officer_id` | Nullable |
| `event_date`, `by_emp_id`, `remarks` | |

### 3.3 Property documents

**`property_documents`** and **`property_document_items`**: one table for all paper the property moves on, told apart by `type`.

| Type | Form | Kind | Phase |
|---|---|---|---|
| `par` | Property Acknowledgment Receipt | PPE | 1 |
| `ics` | Inventory Custodian Slip | SEP | 1 |
| `ptr` | Property Transfer Report | PPE | 4 |
| `itr` | Inventory Transfer Report | SEP | 4 |
| `prs` | Property Return Slip | PPE | 4 |
| `rrsp` | Receipt of Returned Semi-expendable Property | SEP | 4 |
| `iirup` / `iirusp` | Inspection and inventory report of unserviceable property (PPE / SEP) | both | 4 |
| `rlsddp` | Report of Lost, Stolen, Damaged or Destroyed Property | both | 4 |

| Column (`property_documents`) | Notes |
|---|---|
| `type`, `doc_number` | Unique per type, highest + 1 under `lockForUpdate` |
| `doc_date`, `from_officer_id`, `to_officer_id`, `department_code` | |
| `status` | `draft`, `issued`, `void`. Never deleted; a voided number stays spent |
| `reason`, `created_by_emp_id` | |

`property_document_items` links a document to its `property_id` rows.

### 3.4 Count sessions

| Table | Columns |
|---|---|
| `count_sessions` | `id`, `name`, `kind` (`ppe` / `sep`), `as_of_date`, `scope` (all, or listed departments / accounts), `status` (`open`, `counting`, `review`, `closed`), `opened_by_emp_id`, `closed_at` |
| `count_session_members` | `count_session_id`, `full_name`, `position`, `role` (`chair` / `member`), `user_emp_id` (nullable; set when the member enters counts) |
| `count_lines` | `count_session_id`, `property_id` (null for an item found but not on record), the **snapshot** (`expected_officer_id`, `expected_department_code`, `unit_value` as at the start), `result` (`found`, `not_found`, `found_elsewhere`, `not_on_record`), `condition_found`, `location_found`, `description` (for not-on-record items), `counted_by_emp_id`, `counted_at`, `remarks` |

Unique index on `(count_session_id, property_id)`, so an item can't be counted twice in one session.

### 3.5 Import

`import_batches` (file name, uploaded by, status `validated` / `committed` / `rolled_back`, row counts) and `import_rows` (raw row, errors, `property_id` once committed).

---

## 4. Flow from IAR to PAR and ICS

Today every delivered order goes 300 (IAR) → 400 (RIS) → 500 (SSMI) → 550 (release) → 600. Under COA rules, RIS and SSMI are for supplies. PPE goes out on a **PAR**, semi-expendable property on an **ICS**.

### 4.1 Classify each IAR line

When an IAR is made, each `iar_items` line gets a **kind**: `consumable`, `sep` or `ppe`.
- The system **suggests** the kind: unit cost (`bidding_unit_cost`, else `estimated_unit_cost`) at or above ₱50,000 → `ppe`.
- **A person confirms it.** Cost alone can't tell bond paper from a ₱3,000 chair, so below the threshold the IAR officer picks `consumable` or `sep`.
- Later: add a `kind` to the `items` catalogue so the suggestion improves **(A6)**.

### 4.2 Property track (recommended)

```
IAR (300) ──┬─ consumable lines → RIS (400) → SSMI (500) → release (550) → 600   (as today)
            │
            └─ ppe / sep lines  → "For tagging" queue
                                   → property officer creates one property per unit received
                                     (property number, serial, account) → status in_stock
                                   → issue on PAR (ppe) or ICS (sep) to the end user
                                     of the requesting department → status issued
```

- The property track runs **beside** the PO status. It doesn't add new PO codes, so Request Monitoring, the dashboard and the stage averages keep working.
- **Guard:** an order can't reach Completed (600) while it still has untagged or unissued property lines. The check goes where `toRelease` already guards 550 → 600.
- **An order with only PPE/SEP lines** has no supplies to put on an RIS or SSMI. How it passes 400 and 500 is decision 1 **(A7)**. Options: skip to 550 when there are no consumable lines (recommended), or keep RIS/SSMI as the office does now.
- **Ask how the office handles PPE today** (RIS in GSONEO with PAR on paper, or something else) before changing the flow **(A8)**.

### 4.3 PAR and ICS

- A PAR or ICS lists one or more properties, for one accountable officer, on one date.
- Issuing it adds an `issued` event to each property and sets `officer_id`, `department_code` and `status = issued`.
- Its PDF uses the shared letterhead. Signature slots: "Received by" (the officer) and "Issued by" (the property officer), added under `signatories` in `config/documents.php`.
- A wrong PAR is voided (the number stays spent) and a new one is issued.

---

## 5. Opening import

The city already owns property that was bought before GSONEO. The reports can only be as good as this data. **The source is still to be confirmed: Excel, paper, or Accounting's PPE ledger (A9).**

### 5.1 Template

One row per unit, in CSV or XLSX (max 5 MB):

`property_number, kind, account_code, article, description, brand_model, serial_number, unit, unit_value, date_acquired, fund_cluster, officer_name, officer_position, department_code, location, condition, par_ics_number, par_ics_date, remarks`

### 5.2 Steps

1. **Upload** → the batch is saved as `validated`. Nothing touches the register yet.
2. **Validate each row:** required fields; `department_code` and `account_code` exist; numbers and dates parse; no duplicate property numbers (in the file or in the database); `kind` agrees with the value and threshold (rows that don't agree are flagged, not refused, because of **A2**).
3. **Preview:** errors are shown per row, plus totals per account. Fix the file and upload again.
4. **Commit** in one transaction:
   - create the properties;
   - create any missing accountable officers (as matches to review);
   - add an `acquired` event (source `import`) and an `issued` event carrying the old PAR/ICS number in `legacy_number`.
5. **Roll back** a batch only while none of its properties has a later event.

### 5.3 Before go-live

- **Reconcile** the imported totals per account with Accounting's PPE ledger. List the differences. Don't hide them; the first count will settle them.
- **Do the first full count right after the import** (section 6). That count, not the import, is the real opening balance.
- Imported numbers are kept. New numbers follow the GSONEO format **(A5)**.

---

## 6. Count sessions

COA requires a physical count at least once a year, done by an Inventory Committee. The report is usually due to the COA auditor by **January 31** **(A10)**.

### 6.1 Steps

| Step | Who | What happens |
|---|---|---|
| 1. Open | Property officer | Pick PPE or SEP, the "as at" date, the scope (all or some departments/accounts) and the committee members. |
| 2. Snapshot | System | Copies the expected list: every property in scope with its officer, department and value as at that moment. Moves made later don't change it. |
| 3. Count | Committee members | Office by office: scan the QR label or search the property number. Mark it found (with condition and location), or found in another office. Add items found with no record ("not on record"). |
| 4. Review | Property officer | Lists of not found, found elsewhere, not on record, and condition changes. Add remarks. Anything not counted is shown as not found. |
| 5. Close | Property officer | The session becomes read-only, and the RPCPPE or RPCSP is produced. Reopening needs `property.count_manage` and a reason, and is audited. |

### 6.2 Rules

- **The count records facts. It doesn't change the register.** A missing laptop stays on its card until an RLSDDP or a transfer says otherwise. A count can't quietly erase property.
- Each counted line adds a `counted` event to its property card, so the card shows when it was last seen.
- Moves during an open session are allowed but flagged on the review screen.

### 6.3 Devices and labels

- GSONEO is VPN-only. Counting on a phone needs the phone on the VPN (the Tailscale or WireGuard app), or use a laptop with a USB barcode/QR scanner **(A11)**.
- **QR labels:** a PDF sheet of stickers, each with the property number, article and QR code. The QR holds only the property number, which isn't secret. It needs a QR library, for example `chillerlan/php-qrcode` **(A12)**.
- Offline counting (no signal in a building) is not in phase 2. Use paper count sheets printed from the session, then encode them.

---

## 7. Outputs: RPCPPE and RPCSP

### 7.1 RPCPPE layout

Use COA's official layout; confirm the version the auditor expects **(A13)**.

**Header:**
- Type of PPE (the property account)
- "As at" date (the session's `as_of_date`)
- Fund cluster
- "For which *[accountable officer]*, *[designation]*, *[entity]* is accountable, having assumed such accountability on *[date]*"

| Column | Source |
|---|---|
| Article | `properties.article` |
| Description | `description`, brand/model, serial |
| Property number | `property_number` |
| Unit of measure | `unit` |
| Unit value | snapshot `unit_value` |
| Quantity per property card | 1 if expected in the snapshot, 0 for "not on record" |
| Quantity per physical count | 1 if found (here or elsewhere), else 0 |
| Shortage / overage: quantity | count − card |
| Shortage / overage: value | (count − card) × unit value |
| Remarks | Condition, location, "found in [office]", "not on record", committee remarks |

**Signatures:**
- Certified correct by: the Inventory Committee chair and members, taken from the session.
- Approved by: the head of the agency or an authorized representative.
- Verified by: the COA representative.

The last two are new slots under `signatories` in `config/documents.php`.

**Format:** dompdf, legal landscape (the table is wide), with the shared letterhead partials; page breaks per account and per accountable officer. Plus an Excel or CSV export. GSONEO has no spreadsheet library yet: CSV first, or add one such as `openspout/openspout` **(A12)**.

### 7.2 RPCSP

The same engine with `kind = sep`. The columns are the same, with "Semi-expendable property number" and "Semi-expendable property card". Its header uses the type of semi-expendable property.

### 7.3 Summary screen

For each account:
- the number expected and found;
- the shortage and overage values;
- Accounting's ledger balance (typed in) and the difference.

This is the page to bring to Accounting and COA.

### 7.4 Other outputs

| Output | Phase |
|---|---|
| PAR and ICS PDFs | 1 |
| Property card / semi-expendable property card (from `property_events`) | 1 |
| Register list per department or officer, with CSV export | 1 |
| QR label sheets | 2 |
| Shortage follow-up list (for RLSDDP or a demand for accountability) | 4 |

---

## 8. Permissions and roles

A new **Property** group in `config/permissions.php`:

| Permission | Grants |
|---|---|
| `property.view` | Register, property cards, PAR/ICS and other documents (read) |
| `property.manage` | Tag items from the IAR, edit property details, issue PAR/ICS, transfers and returns |
| `property.dispose` | Record unserviceable, disposed and lost property |
| `property.import` | Opening import (set-up only) |
| `property.count` | Enter counts in an open session |
| `property.count_manage` | Open, review, close and reopen count sessions |
| `property.reports` | Print the RPCPPE, RPCSP, registers and label sheets; export |

Suggested starting roles **(A14)**:

| Section → role | Permissions |
|---|---|
| Property → Property Officer | `view`, `manage`, `count_manage`, `reports`, `import` (remove `import` after go-live) |
| Property → Property Encoder | `view`, `manage` |
| Property → Inventory Committee | `view`, `count` (members from Accounting and other offices get accounts with only this role) |
| Administration → Department Head | `view`, `reports`, `dispose` |
| Inventory and Sales → Section Head, Encoder (IAR) | `view` (to see what the IAR line became) |
| Sys Admin → Superadmin | everything (`*`) |

These follow the existing pattern: routes use `permission:` middleware, the sidebar links in `navigation.js` carry the permission, and a migration grants new permissions to roles that already exist (see DOCUMENTATION.md §10, "Add a permission").

**Separation of duties:**
- The person who tags a property can't also be the only committee member who counts it.
- Disposal needs `property.dispose`, which encoders don't have.

---

## 9. Audit, privacy and tests

**Audit:** every event and document writes to `audit_log` through `LogsAudit`, with actions such as `property_tagged`, `par_issued`, `ics_issued`, `property_transferred`, `property_disposed`, `count_session_opened`, `count_recorded`, `count_session_closed` and `import_committed`. Voided documents keep their reason.

**Privacy (RA 10173):** accountable officers' names and positions are personal data, and they rightly appear on government forms. Keep them inside GSONEO. Never show them on the kiosk or the lookup API ([API-PLAN.md](API-PLAN.md)). Let the city DPO know about the new data **(A15)**.

**Pest tests:**
- numbering: no duplicate property, PAR or ICS numbers, even under double submits;
- the snapshot doesn't change when an item is transferred during an open count;
- shortage and overage quantity and value math;
- an order with untagged property lines can't reach 600;
- a closed session can't be edited without `property.count_manage`;
- import validation: duplicates, unknown department, value/kind mismatch;
- permissions: each route answers 403 without its permission.

---

## 10. Build order

The next count is due around **January 2027** **(A10)**. The count works on imported data alone, so build the register, import and count **before** the IAR flow.

| Phase | Work | Why this order |
|---|---|---|
| 0. Confirm | Answers to A1–A15, especially the source data (A9), number format (A5) and forms (A13). Seed `property_accounts` and departments | Nothing else can start right without these |
| 1. Register + import | Tables, opening import, property cards, PAR/ICS (including old ones as legacy), register lists | Gives a register to count against |
| 2. Count + reports | Count sessions, QR labels, RPCPPE, RPCSP, summary screen | Meets the yearly count |
| 3. IAR → property track | Line classification, "For tagging" queue, PAR/ICS from deliveries, the 600 guard | New purchases join the register from then on |
| 4. Movements | PTR/ITR, returns (PRS/RRSP), unserviceable and disposal (IIRUP/IIRUSP), lost (RLSDDP), dashboard widgets, link to Motor Pool vehicles | Keeps the register right through the year |

---

## Assumptions to confirm

| # | Assumption | Ask or check |
|---|---|---|
| A1 | The capitalization threshold is ₱50,000 per unit | Accounting, COA auditor |
| A2 | How items bought under the old ₱15,000 threshold are classed | Accounting |
| A3 | Only movable property is in scope; land and buildings stay out | CGSO head |
| A4 | Property account codes and names come from Accounting's chart of accounts | Accounting |
| A5 | Property number format (and whether old numbers are kept) | CGSO property section, Accounting |
| A6 | Adding a `kind` to the items catalogue | CGSO head |
| A7 | PPE-only orders skip RIS and SSMI (go to 550 when there are no consumable lines) | CGSO head, Supply Officer |
| A8 | How PPE is handled in GSONEO today | Supply Officer |
| A9 | Where the current property records are: Excel, paper or Accounting's ledger | CGSO property section |
| A10 | The count is yearly and due to COA by January 31 | COA auditor |
| A11 | Counting devices: phones on the VPN, or laptops with scanners | City IT |
| A12 | New libraries: QR codes and a spreadsheet export | My call |
| A13 | The RPCPPE and RPCSP form versions COA expects for an LGU | COA auditor |
| A14 | Starting roles and who sits on the Inventory Committee | CGSO head, Mayor's office order |
| A15 | The DPO is told about the accountable officers data | City DPO |

## Decisions to make

1. **How property lines pass the PO flow:** a property track beside the PO status, where PPE-only orders skip RIS/SSMI (recommended), or new PO status codes.
2. **Scope:** movable PPE and semi-expendable property first (recommended), or land and buildings too.
3. **Opening data:** which source to import (A9), and who signs off the opening balance with Accounting before the first count.
