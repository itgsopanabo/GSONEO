# GSONEO Plan: PO Report for COA

> **Plan only. Nothing here is built yet.**
> Items marked **(A#)** are assumptions to confirm; they are listed in [Assumptions to confirm](#assumptions-to-confirm). For how the system works today, see [DOCUMENTATION.md](DOCUMENTATION.md).

## Contents

1. [Goal and scope](#1-goal-and-scope)
2. [Report columns](#2-report-columns)
3. [Splitting the PO and PR numbers](#3-splitting-the-po-and-pr-numbers)
4. [Which orders are listed](#4-which-orders-are-listed)
5. [Screen, PDF and export](#5-screen-pdf-and-export)
6. [Permissions, audit and tests](#6-permissions-audit-and-tests)
7. [Build order](#7-build-order)
8. [SQL console version (usable now)](#8-sql-console-version-usable-now)

---

## 1. Goal and scope

**Goal:** CGSO prints a list of the purchase orders it issued in a period, to submit to the COA auditor. Today this list is made by hand from the PO files.

**In scope:** a report page, a PDF in the official layout, and a CSV export. It reads data GSONEO already has. **No new tables.**

**Out of scope for now:** sending the report to COA from the system, and the PO form itself.

---

## 2. Report columns

One row per purchase order **(A1)**.

| # | Column | Sub-columns | Source |
|---|---|---|---|
| 1 | Item No. | | Row number in the report: 1, 2, 3… It starts again at 1 on each report |
| 2 | PO Number | Year · Month · No. | `purchase_order.PO_Number`, split as in section 3 |
| 3 | PO Date | | `purchase_order.PO_Date` |
| 4 | PR Number | Year · Month · No. | `purchase_order.PR_Number`, split as in section 3 |
| 5 | Supplier | | `purchase_order.PO_Supplier` |
| 6 | Particulars (Description) | | The order's request lines (`purchase_request_items`): quantity, unit, `item_name` and `item_desc`, one line each |
| 7 | Date Received | | `purchase_order.received_at`: when the delivery was accepted on the Incoming page **(A2)** |
| 8 | Amount | | Sum of quantity × unit cost over the request lines. Unit cost is `bidding_unit_cost`, else `estimated_unit_cost`, the same rule as the SSMI **(A3)** |
| 9 | Requesting Office | | `purchase_requests.requester_department` **(A4)** |

The last row is the **total** of the Amount column.

**Notes on the data:**
- **Date Received is blank for orders accepted before 2026-10-14.** `received_at` was added then, and older acceptances were never recorded (see the migration `2026_10_14_000200_add_delivery_acceptance_to_purchase_order`). The old `supplier_receive_date` field never had a column, so it can't fill the gap. Print the cell blank; don't guess a date.
- **Amount is what was ordered, not what was delivered.** For a partial delivery the two differ. The delivered amount can come from `PurchaseOrder::receivedQuantities()` if COA wants that instead **(A3)**.
- Particulars can be long. The cell wraps; the row grows. Nothing is cut.

---

## 3. Splitting the PO and PR numbers

The report shows each number in three small columns: **Year · Month · No.**

GSONEO's numbers today:

| Number | Format | Made by |
|---|---|---|
| PO | `PO-YYYY-NNNNN`, for example `PO-2026-00012` | `PurchaseOrderController::generatePONumber`, `PurchaseRequestController::generatePONumber` |
| PR | `PR-YYYY-NNNN`, for example `PR-2026-0045` | `PurchaseRequestController::generatePrNumber` |
| Encoded PR | `EPR-YYYY-NNNN`, for example `EPR-2026-0007` | `EncodingController::nextPrNumber` |

**The numbers carry the year but not the month.** So:

| Sub-column | PO | PR |
|---|---|---|
| Year | From the number | From the number |
| Month | Month of `PO_Date` | Month of `purchase_requests.created_at` **(A5)** |
| No. | Sequence part of the number, zeros kept: `00012` | Sequence part: `0045`. Encoded PRs keep an `E`: `E0007`, so they don't look the same as `PR-…-0007` **(A6)** |

Example: `PO-2026-00012` dated 2026-03-15 for `PR-2026-0045` made 2026-03-02 prints as **2026 · 03 · 00012** and **2026 · 03 · 0045**.

**Rules:**
- Split with one pattern, `^(E?PR|PO)-(\d{4})-(\d+)$`, in one helper used by the page, the PDF and the CSV.
- A number that doesn't match (old or hand-typed formats) prints whole in the No. column, with Year and Month blank. It is never changed to fit.
- Month prints as two digits, `03` **(A7)**.

---

## 4. Which orders are listed

- Orders **with a PO number**, whose **`PO_Date` falls in the chosen period**. The period is a month by default, or a date range.
- **Cancelled orders (status 800)** stay on the list so the number sequence has no unexplained gaps. They show "CANCELLED" in Particulars, no amount, and are left out of the total **(A8)**.
- Sorted by PO number, so the Item No. follows the PO sequence.
- **Filters:** period, requesting office, supplier.

Dates are Asia/Manila time, as everywhere in GSONEO (DOCUMENTATION.md §1, "Dates and times").

---

## 5. Screen, PDF and export

**Page:** *Monitoring and reports → PO Report for COA*. It shows the filters, the table with the sub-columns, the total, and two buttons: **Print PDF** and **Export CSV**.

**PDF:**
- dompdf, **legal landscape** (nine columns, three of them split), with the shared letterhead partials (DOCUMENTATION.md §8).
- Header: "Report of Purchase Orders Issued", the period, and the office **(A9)**.
- Column headers in two rows: "PO Number" and "PR Number" span their Year · Month · No. cells.
- The header row repeats on every page; the total prints on the last page.
- Signatures: "Prepared by" and "Certified correct by". The report gets its own entry under `signatories` in `config/documents.php` with these two as its starting signers, plus a "Default" set added in its migration, so admins can change or add signers on PDF Signatories **(A10)**. The report covers many requests, so it prints the default set (`Signatories::for('po_report', null)`) and has no per-request picker.

**CSV:** the same rows, with the sub-columns as separate columns (`PO Year`, `PO Month`, `PO No.`, …), so it opens cleanly in Excel. GSONEO has no spreadsheet library, so CSV comes first.

**Code pieces:**

| Piece | Where |
|---|---|
| Controller | `app/Http/Controllers/PoReportController.php`: `index`, `pdf`, `csv`, one shared query |
| Number splitter | A small helper, for example `App\Support\DocumentNumber::split()` |
| Page | `resources/js/Pages/Reports/PoReportCoa.jsx` |
| PDF template | `resources/views/pdf/po-report-coa.blade.php` |
| Routes | `routes/web.php`, in the "Monitoring and reports" block |
| Sidebar link | `navigation.js`, with the permission |

---

## 6. Permissions, audit and tests

**Permission:** a new `reports.po_coa` (*PO report for COA: view, print and export the list of purchase orders*) in the reports group of `config/permissions.php`. A migration grants it to the roles that already exist **(A11)**. See DOCUMENTATION.md §10, "Add a permission".

**Audit:** printing or exporting writes an `audit_log` row (`Print PO Report for COA` / `Export PO Report for COA`) with the period and filters, so there is a record of what was submitted.

**Privacy:** the report holds supplier names and amounts, which are public procurement data. It shows no personal data of staff.

**Pest tests:**
- the splitter: PO, PR and EPR numbers; a number that doesn't match prints whole;
- the month comes from `PO_Date` and `created_at`, not from the number;
- the amount uses the bidding cost, else the estimate;
- cancelled orders are listed but not in the total;
- the period filter uses `PO_Date`; orders with no PO number are left out;
- a blank `received_at` prints blank;
- each route answers 403 without `reports.po_coa`.

---

## 7. Build order

| Step | Work |
|---|---|
| 0. Confirm | Answers to A1–A11, and a sample of the paper report COA receives today |
| 1. Query and page | Controller, number splitter, page with filters and table |
| 2. PDF | Template in the COA layout, signatories |
| 3. CSV, permission, audit | Export, `reports.po_coa`, audit rows, tests |

---

## 8. SQL console version (usable now)

Until the report page is built, this query gives the same rows in the SQL console (`reports.sql`). Save it there as a **shared** saved query named "PO Report for COA", then export it to CSV.

**Why not the Report builder (`reports.custom`):** it lists raw table columns only. It can't split the numbers, join the request lines into Particulars, add up the Amount, or number the rows.

**How to use it:**
1. Change the two dates in `report_period` to the period of the report.
2. Run it. Above the result, set the **Report title** (it starts as the saved query's name) and the **Description**, for example the period. Both print at the top of the PDF and the CSV.
3. **Save as PDF** for a printed copy on the letterhead, or **Download CSV** to finish it in Excel. Both have every row; the preview stops at 1,000, and a PDF stops at 3,000.
4. In Excel, the title and description are the first rows, then a blank row. Delete the row of column letters (A–M) under them. The next two rows are the report's header:

   ```
   Item No. | PO Number          | PO Date | PR Number          | Supplier | Particulars (Description) | Date Received | Amount | Requesting Office
            | Year | MM | Number |         | Year | MM | Number |          |                           |               |        |
   ```

5. Select "PO Number" and the two empty cells to its right, then **Merge & Center**. Do the same for "PR Number". To make the other titles fill both header rows, merge each one with the empty cell below it.

The column names are letters because SQL has only one header row, and the console needs every column name to be different. So the real header is built as the first two rows of the result. The report page (section 5) will print the merged header by itself.

It follows the defaults in this plan: one row per PO (A1), Date Received from `received_at` (A2), ordered amount (A3), cancelled orders listed with no amount (A8). The last row is the total.

```sql
WITH report_period AS (
    SELECT DATE '2026-10-01' AS date_from, DATE '2026-10-31' AS date_to
),
pr_lines AS (
    SELECT
        i.purchase_request_id,
        COUNT(*) AS line_count,
        GROUP_CONCAT(
            CONCAT_WS(' ', i.quantity, i.unit, NULLIF(i.item_name, ''), CONCAT('- ', NULLIF(i.item_desc, '')))
            ORDER BY i.id SEPARATOR '\n'
        ) AS particulars,
        SUM(i.quantity * COALESCE(i.bidding_unit_cost, i.estimated_unit_cost, 0)) AS amount
    FROM purchase_request_items i
    GROUP BY i.purchase_request_id
),
po_rows AS (
    SELECT
        ROW_NUMBER() OVER (ORDER BY po.PO_Number, po.id) AS item_no,
        po.PO_Number AS po_number,
        po.PO_Date AS po_date,
        po.PR_Number AS pr_number,
        pr.created_at AS pr_date,
        po.PO_Supplier AS supplier,
        po.received_at AS received_at,
        pr.requester_department AS office,
        po.status = 800 AS is_cancelled,
        l.particulars,
        l.line_count,
        LENGTH(l.particulars) >= @@SESSION.group_concat_max_len - 3 AS is_cut,
        l.amount
    FROM purchase_order po
    CROSS JOIN report_period p
    LEFT JOIN purchase_requests pr ON pr.pr_number = po.PR_Number
    LEFT JOIN pr_lines l ON l.purchase_request_id = pr.id
    WHERE po.PO_Number IS NOT NULL
      AND po.PO_Date >= p.date_from
      AND po.PO_Date < p.date_to + INTERVAL 1 DAY
),
report AS (
    SELECT
        -2 AS part, NULL AS sort_no,
        'Item No.' AS c_item,
        'PO Number' AS c_po_year, '' AS c_po_month, '' AS c_po_no,
        'PO Date' AS c_po_date,
        'PR Number' AS c_pr_year, '' AS c_pr_month, '' AS c_pr_no,
        'Supplier' AS c_supplier,
        'Particulars (Description)' AS c_particulars,
        'Date Received' AS c_received,
        'Amount' AS c_amount,
        'Requesting Office' AS c_office
    UNION ALL
    SELECT
        -1, NULL,
        '',
        'Year', 'MM', 'Number',
        '',
        'Year', 'MM', 'Number',
        '', '', '', '', ''
    UNION ALL
    SELECT
        0,
        item_no,
        CAST(item_no AS CHAR),
        IF(po_number REGEXP '^PO-[0-9]{4}-[0-9]+$', SUBSTRING(po_number, 4, 4), ''),
        IF(po_number REGEXP '^PO-[0-9]{4}-[0-9]+$', DATE_FORMAT(po_date, '%m'), ''),
        IF(po_number REGEXP '^PO-[0-9]{4}-[0-9]+$', SUBSTRING_INDEX(po_number, '-', -1), po_number),
        DATE_FORMAT(po_date, '%Y-%m-%d'),
        IF(pr_number REGEXP '^E?PR-[0-9]{4}-[0-9]+$', SUBSTRING_INDEX(SUBSTRING_INDEX(pr_number, '-', 2), '-', -1), ''),
        IF(pr_number REGEXP '^E?PR-[0-9]{4}-[0-9]+$', DATE_FORMAT(pr_date, '%m'), ''),
        IF(pr_number REGEXP '^E?PR-[0-9]{4}-[0-9]+$',
           CONCAT(IF(pr_number LIKE 'EPR-%', 'E', ''), SUBSTRING_INDEX(pr_number, '-', -1)),
           COALESCE(pr_number, '')),
        COALESCE(supplier, ''),
        CASE
            WHEN is_cancelled THEN 'CANCELLED'
            WHEN is_cut THEN CONCAT(particulars, '\n(cut off: ', line_count, ' lines in all, see the PR)')
            ELSE COALESCE(particulars, '')
        END,
        COALESCE(DATE_FORMAT(received_at, '%Y-%m-%d'), ''),
        IF(is_cancelled, '', COALESCE(CAST(amount AS CHAR), '')),
        COALESCE(office, '')
    FROM po_rows
    UNION ALL
    SELECT
        1, NULL,
        '', '', '', '', '', '', '', '', '',
        'TOTAL',
        '',
        COALESCE(CAST(SUM(CASE WHEN is_cancelled THEN NULL ELSE amount END) AS CHAR), '0.00'),
        ''
    FROM po_rows
)
SELECT
    c_item AS `A`,
    c_po_year AS `B`,
    c_po_month AS `C`,
    c_po_no AS `D`,
    c_po_date AS `E`,
    c_pr_year AS `F`,
    c_pr_month AS `G`,
    c_pr_no AS `H`,
    c_supplier AS `I`,
    c_particulars AS `J`,
    c_received AS `K`,
    c_amount AS `L`,
    c_office AS `M`
FROM report
ORDER BY part, sort_no
```

**Limits to know:**
- **Long Particulars can be cut.** MySQL's `GROUP_CONCAT` stops at `group_concat_max_len` (1,024 bytes by default, about 15 lines of items). The console can't change it, so a cut cell ends with "(cut off: N lines in all, see the PR)". To remove the limit, add `--group-concat-max-len=1000000` to the `db` service's `command` in `docker-compose.yaml` and restart the database.
- **The PR month is the date the PR was created in GSONEO** (A5). For encoded PRs (`EPR-`), that is the encoding date.
- **Date Received is blank before 2026-10-14** (see section 2).
- Only people with `reports.sql` can run it. A shared saved query is seen only by console users.

## Assumptions to confirm

| # | Assumption | Ask or check |
|---|---|---|
| A1 | One row per PO, with all its items in Particulars (not one row per item) | COA auditor, CGSO head |
| A2 | "Date Received" means the date the delivery was accepted, not the date the supplier received the PO | CGSO head |
| A3 | Amount is the ordered amount (bidding cost, else estimate), not the delivered amount | COA auditor, Accounting |
| A4 | Requesting Office prints the office name; the code (`Department_Code`) is an option | CGSO head |
| A5 | The PR month comes from the date the PR was created in GSONEO. For encoded PRs this is the encoding date, not the date on the paper PR. If that matters, add a `pr_date` column | CGSO head |
| A6 | Encoded PRs show an `E` in the No. column | CGSO head |
| A7 | Month prints as two digits (`03`), not a name (`Mar`) | COA auditor |
| A8 | Cancelled POs stay on the list with no amount | COA auditor |
| A9 | The report title and the period the auditor wants (monthly or quarterly) | COA auditor |
| A10 | Who signs the report | CGSO head |
| A11 | Which roles get `reports.po_coa` | CGSO head |
