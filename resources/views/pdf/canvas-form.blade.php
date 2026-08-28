<!DOCTYPE html>
<html lang="en">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <meta charset="utf-8">
    <title>Canvass Forms Print Preview</title>

    <style>
        @font-face {
            font-family: 'DejaVu Sans';
            font-style: normal;
            font-weight: normal;
            src: url('{{ storage_path('fonts/DejaVuSans.ttf') }}') format('truetype');
        }

        /* ===== Global Print Area Definition ===== */
        @page {
            size: legal;
            margin: 0.5in !important; /* Strict 0.5-inch border on all sides of EVERY page */
        }

        /* ===== Base Reset ===== */
        html, body {
            font-family: 'DejaVu Sans', sans-serif;
            color: #000000 !important;
            font-size: 11px;
            line-height: 1.4;
            margin: 0; /* Clear margin constraint to let @page rule control page 1 */
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
        }

        /* ===== Document Sheet Flow Rules ===== */
        .canvas-sheet {
            background: #ffffff !important;
            background-color: #ffffff !important;
            margin: 0 auto;
            max-width: 100% !important;
            width: 100% !important;
            display: block;
            box-shadow: none !important;
            padding: 0 !important; /* Relies entirely on the 0.5in @page margin */

            /* Break BEFORE the document instead of after to prevent trailing blank pages */
            page-break-before: always !important;
            break-before: page !important;
        }

        /* The very first canvas sheet doesn't need a leading blank page break */
        .canvas-sheet:first-child {
            page-break-before: avoid !important;
            break-before: avoid !important;
        }

        /* ===== Header Layout ===== */
        .header-table {
            width: 100%;
            border-bottom: 2px solid #000000;
            margin-bottom: 12px;
            padding-bottom: 6px;
        }

        .header-logo {
            width: 70px;
            text-align: center;
        }

        .header-logo img {
            width: 55px;
            height: auto;
        }

        .header-text {
            text-align: center;
            line-height: 1.2;
        }

        .header-text p {
            margin: 0;
            font-size: 11px;
            font-style: italic;
        }

        .office-title {
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
            margin: 4px 0 0 0;
        }

        .service-motto {
            font-size: 9px;
            font-style: italic;
            text-align: right;
        }

        /* ===== Metadata Blocks ===== */
        .meta-block {
            width: 100%;
            margin-bottom: 12px;
        }

        .meta-block table {
            width: 100%;
            border-collapse: collapse;
        }

        .meta-block td {
            padding: 2px 0;
            vertical-align: bottom;
        }

        .meta-label {
            font-weight: bold;
            width: 120px;
            text-align: right;
            padding-right: 8px;
        }

        .meta-fill {
            border-bottom: 1px solid #000000;
        }

        /* ===== Body Text ===== */
        .intro-text {
            margin: 12px 0;
            text-align: justify;
        }

        /* ===== Items Table Data Matrix ===== */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
            background-color: #ffffff;
        }

        thead {
            display: table-header-group !important; /* Repeats table headers on subsequent pages */
        }

        tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        .items-table th,
        .items-table td {
            border: 1px solid #000000;
            padding: 6px 8px;
            vertical-align: top;
            background-color: #ffffff;
        }

        .items-table th {
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            text-align: center;
        }

        .items-table td.qty,
        .items-table td.unit,
        .items-table td.cost,
        .items-table td.total {
            text-align: right;
        }

        .total-row td {
            font-weight: bold;
            border-top: 2px solid #000000;
        }

        /* ===== Delivery & Purpose Parameters ===== */
        .note-block {
            margin-top: 12px;
            padding: 6px 0;
            border-bottom: 1px solid #000000;
        }

        .purpose-block {
            padding: 6px 0;
            border-bottom: 1px solid #000000;
        }

        /* ===== Signatures Framework ===== */
        .footer-table {
            width: 100%;
            margin-top: 20px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .footer-table td {
            vertical-align: top;
            width: 50%;
        }

        .sig-line {
            border-bottom: 1px solid #000000;
            display: inline-block;
            width: 220px;
            margin-bottom: 2px;
        }

        .sig-caption {
            font-size: 10px;
        }

        .signatory-name {
            font-weight: bold;
            margin-top: 25px;
        }

        .signatory-title {
            font-size: 10px;
        }

        .bac-date {
            margin-top: 12px;
        }

        /* ===== Media Print Enforcements ===== */
        @media print {
            .no-print {
                display: none !important;
            }

            *, div, table, tr, td, th, span, p {
                background: #ffffff !important;
                background-color: #ffffff !important;
                box-shadow: none !important;
                outline: none !important;
            }
        }
    </style>

</head>
<body>

@foreach($documents as $form)
    <div class="canvas-sheet">

        <table class="header-table">
            <tr>
                <td class="header-logo">
                    @if(file_exists(public_path('images/doh-logo.png')))
                        <img src="{{ public_path('images/doh-logo.png') }}" alt="Logo">
                    @endif
                </td>
                <td class="header-text">
                    <p>Republic of the Philippines</p>
                    <p>Province of Davao del Norte</p>
                    <p>Panabo City</p>
                    <div class="office-title">Office of the General Services</div>
                </td>
                <td class="header-logo">
                    @if(file_exists(public_path('images/center-logo.png')))
                        <img src="{{ public_path('images/center-logo.png') }}" alt="Logo">
                    @endif
                    <div class="service-motto">Service to Panaboños<br>Service to God</div>
                </td>
            </tr>
        </table>

        <div class="meta-block">
            <table>
                <tr>
                    <td style="width: 55%;">
                        <div style="margin-bottom: 2px; white-space: nowrap;">
                            <span
                                style="display: inline-block; width: 220px; border-bottom: 1px solid #000000;">&nbsp;</span>
                        </div>
                    </td>
                    <td class="meta-label">Canvass #:</td>
                    <td class="meta-fill">{{ $form->CF_Number ?? '' }}</td>
                </tr>
                <tr>
                    <td>
                        <div style="margin-bottom: 2px; white-space: nowrap;">
                            <span
                                style="display: inline-block; width: 220px; border-bottom: 1px solid #000000;">&nbsp;</span>
                        </div>
                    </td>
                    <td class="meta-label">To be opened on:</td>
                    <td class="meta-fill">{{ $form->CF_to_be_Open ?? '' }}</td>
                </tr>
                <tr>
                    <td>
                        <div style="margin-bottom: 2px; white-space: nowrap;">
                            <span
                                style="display: inline-block; width: 220px; border-bottom: 1px solid #000000;">&nbsp;</span>
                        </div>
                    </td>
                    <td class="meta-label">PR #:</td>
                    <td class="meta-fill">{{ $form->purchaseRequest->pr_number ?? '' }}</td>
                </tr>
                <tr>
                    <td>
                        <div style="margin-bottom: 2px; white-space: nowrap;">
                            <span
                                style="display: inline-block; width: 220px; border-bottom: 1px solid #000000;">&nbsp;</span>
                        </div>
                    </td>
                    <td class="meta-label">Delivery period:</td>
                    <td class="meta-fill">{{ $form->CF_delivery_Period ?? '' }}</td>
                </tr>
            </table>
        </div>

        <p>Sir/ Madam:</p>

        <p class="intro-text">
            Please quote your price of the items listed hereunder which this City desired to buy from you, should the
            said price be found to be just and fit and not in excess of the prevailing prices in the City of Panabo.
            Your quotations should not be made known to the other dealers until all quotations are opened in this
            Requisition Office.
        </p>

        <table class="items-table">
            <thead>
            <tr>
                <th style="width: 8%;">QTY</th>
                <th style="width: 8%;">UNIT</th>
                <th>PARTICULARS</th>
                <th style="width: 12%;">COUNTRY<br>OF ORIGIN</th>
                <th style="width: 10%;">UNIT<br>COST</th>
                <th style="width: 12%;">TOTAL</th>
                <th style="width: 12%;">REMARKS</th>
            </tr>
            </thead>
            <tbody>
            @php
                $items = $form->purchaseRequest->items ?? [];
            @endphp

            @foreach($items as $item)
                <tr>
                    <td class="qty" style="text-align: center;">{{ $item->quantity ?? 0 }}</td>
                    <td class="unit" style="text-align: center;">{{ $item->unit ?? 'pc' }}</td>
                    <td>
                        <strong style="text-transform: uppercase;">{{ $item->item_name ?? 'Unspecified Item' }}</strong>
                        @if(!empty($item->item_desc))
                            <br><span
                                style="font-size: 10px; line-height: 1.3; display: block; margin-top: 2px;">{{ $item->item_desc }}</span>
                        @endif
                    </td>
                    <td class="origin"></td>
                    <td class="cost" style="text-align: right; white-space: nowrap;">
                        ₱{{ number_format($item->estimated_unit_cost ?? 0, 2) }}</td>
                    <td class="total" style="text-align: right; white-space: nowrap;">
                        ₱{{ number_format(($item->quantity ?? 0) * ($item->estimated_unit_cost ?? 0), 2) }}</td>
                    <td class="remarks"></td>
                </tr>
            @endforeach

            <tr class="total-row">
                <td colspan="5" style="text-align: right; font-weight: bold;">TOTAL</td>
                <td class="total" style="text-align: right; font-weight: bold; white-space: nowrap;">
                    ₱{{ number_format(collect($items)->sum(fn($it) => ($it->quantity ?? 0) * ($it->estimated_unit_cost ?? 0)), 2) }}
                </td>
                <td></td>
            </tr>
            </tbody>
        </table>

        <div class="note-block">
            The above articles will be delivered at
            <strong><u>GSO WAREHOUSE (Motorpool), Brgy. Datu Abdul, Panabo City.</u></strong>
            If purchase of the above articles are to be affected, a requisition for supplies will only be made in your
            favor.
        </div>

        <div class="purpose-block">
            <strong>Purpose:</strong> {{ $form->purchaseRequest->purpose ?? $form->purchaseRequest->remarks_or_notes ?? '' }}
        </div>

        <table class="footer-table">
            <tr>
                <td>
                    <br><br>
                    <span class="sig-line">&nbsp;</span><br>
                    <span class="sig-caption">Name of Company Dealer</span>
                    <br><br>
                    TIN: <span class="sig-line" style="width: 160px;">&nbsp;</span>
                    <br><br><br>
                    <span class="sig-line"><strong>{{ $form->CF_canvasser ?? '' }}</strong></span><br>
                    <span class="sig-caption">Canvass By</span>
                </td>
                <td style="text-align: left;">
                    Very truly yours,
                    <div class="signatory-name">ENGR. RANDEL B. PANAYANGAN</div>
                    <div class="signatory-title">CGDH-CGSO</div>
                    <div class="bac-date">
                        BAC Date: <u>{{ \Carbon\Carbon::parse($form->CF_bac_date)->format('F d, Y') }}</u>
                    </div>
                </td>
            </tr>
        </table>

    </div>
@endforeach

<script>
    // Trigger the print dialog once the page has finished rendering.
    window.addEventListener('DOMContentLoaded', () => {
        window.print();
    });

    // ---- Best-effort refresh blocking -------------------------------
    // Browsers intentionally do not allow JavaScript to fully disable
    // page refresh (F5 / the reload button) — this is a deliberate
    // security restriction, not a limitation we can code around. What
    // follows is the maximum available: intercepting the common
    // keyboard shortcuts, and asking the browser to show its native
    // "leave site?" confirmation before a refresh/close/navigation goes
    // through. A user can still confirm past that native dialog, and
    // clicking the browser's own reload button cannot be intercepted at
    // all — only keyboard shortcuts can be caught this way.

    window.addEventListener('keydown', function (e) {
        const isF5 = e.key === 'F5';
        const isCtrlR = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r';
        if (isF5 || isCtrlR) {
            e.preventDefault();
        }
    });

    window.addEventListener('beforeunload', function (e) {
        e.preventDefault();
        e.returnValue = '';
    });
</script>
</body>
</html>
