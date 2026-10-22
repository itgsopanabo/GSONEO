<!DOCTYPE html>
<html lang="en">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <meta charset="utf-8">
    <title>PR-{{ $purchaseRequest->pr_number }}</title>

    <style>
        @font-face {
            font-family: 'DejaVu Sans';
            font-style: normal;
            font-weight: normal;
            src: url('{{ storage_path('fonts/DejaVuSans.ttf') }}') format('truetype');
        }

        body {
            font-family: 'DejaVu Sans', sans-serif;
            color: #000000;
            font-size: 11px;
            line-height: 1.3;
            margin: 0;
            padding: 10px;
        }

        /* Outer Border Layout */
        .pr-container {
            border: 2px solid #000000;
            padding: 0;
            width: 100%;
        }

        /* Top Bar Segment: the shared letterhead, closed off from the form below */
        table.doc-letterhead.pr-letterhead {
            border-bottom: 2px solid #000000;
        }

        /* Metadata Tracking Section */
        .meta-section-table {
            width: 100%;
            border-collapse: collapse;
            border-bottom: 1px solid #000000;
        }

        .meta-section-table td {
            padding: 5px;
            border-right: 1px solid #000000;
            vertical-align: middle;
        }

        .meta-section-table td:last-child {
            border-right: none;
        }

        /* Core Items Grid Layout */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            /* Explicitly define the full outer boundaries */
            border: 1px solid #000000;
        }

        .items-table th {
            font-weight: bold;
            text-transform: uppercase;
            padding: 6px 4px;
            text-align: center;
            font-size: 10px;
            border-bottom: 1px solid #000000;
            border-right: 1px solid #000000;
        }

        .items-table td {
            padding: 6px 5px;
            vertical-align: top;
            /* Explicitly add top and bottom lines to each cell to prevent dropping lines */
            border-bottom: 1px solid #000000;
            border-right: 1px solid #000000;
        }

        /* Remainder fix for the last cells in each row */
        .items-table th:last-child,
        .items-table td:last-child {
            border-right: none;
        }

        .item-name {
            font-weight: bold;
            margin: 0 0 3px 0;
        }

        .item-desc {
            font-size: 10px;
            color: #222222;
            white-space: pre-line;
            margin: 0;
        }

        /* Total Row Styling */
        .total-row td {
            border-top: 1px solid #000000;
            font-weight: bold;
            padding: 8px 5px;
        }

        .double-underline {
            border-bottom: 3px double #000000;
            display: inline-block;
        }

        /* Purpose Field */
        .purpose-box {
            padding: 8px;
            border-bottom: 1px solid #000000;
            font-size: 11px;
        }

        /* Standard LGU 3-Column Signatory Matrix Footer */
        .signatory-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .signatory-table th {
            font-weight: normal;
            text-align: left;
            padding: 4px;
            border-right: 1px solid #000000;
            border-bottom: 1px solid #000000;
            font-size: 10px;
        }

        .signatory-table td {
            padding: 25px 5px 5px 5px;
            border-right: 1px solid #000000;
            text-align: center;
            vertical-align: bottom;
        }

        .signatory-table th:last-child, .signatory-table td:last-child {
            border-right: none;
        }

        .sig-name {
            font-weight: bold;
            text-transform: uppercase;
            text-decoration: underline;
        }

        .sig-title {
            font-size: 10px;
            display: block;
            margin-top: 2px;
        }

        .sig-date {
            font-size: 9px;
            margin-top: 4px;
            color: #444444;
        }

        .text-right {
            text-align: right;
        }

        .text-center {
            text-align: center;
        }
    </style>
    @include('pdf.partials.branding-styles')
</head>
<body>
@include('pdf.partials.foreground')
@php $sig = $signatories['purchase_request']['slots']; @endphp

<div class="pr-container">

    @include('pdf.partials.letterhead', ['documentTitle' => 'Purchase Request', 'class' => 'pr-letterhead'])

    <table class="meta-section-table">
        <tr>
            <td style="width: 50%;">
                <strong>Department:</strong> {{ $purchaseRequest->requester_department ?? 'GNS' }}<br>
                <strong>Section:</strong> Panabo City Infirmary
            </td>
            <td style="width: 50%; padding: 0;">
                <table style="width: 100%; border-collapse: collapse; border: none;">
                    <tr>
                        <td style="border: none; padding: 4px 5px; width: 60%;">
                            <strong>PR No.:</strong> {{ $purchaseRequest->pr_number }}
                        </td>
                        <td style="border: none; padding: 4px 5px; width: 40%;">
                            <strong>Date:</strong> {{ $purchaseRequest->needed_by_date ? \Carbon\Carbon::parse($purchaseRequest->needed_by_date)->format('M d Y') : \Carbon\Carbon::now()->format('M d Y') }}
                        </td>
                    </tr>
                    <tr>
                        <td style="border: none; padding: 4px 5px;">
                            <strong>SAI No.:</strong> <span
                                style="display: inline-block; width: 100px; border-bottom: 1px solid #000;">&nbsp;</span>
                        </td>
                        <td style="border: none; padding: 4px 5px;">
                            <strong>Date:</strong> <span
                                style="display: inline-block; width: 80px; border-bottom: 1px solid #000;">&nbsp;</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="border: none; padding: 4px 5px;">
                            <strong>ALOBS No.:</strong> <span
                                style="display: inline-block; width: 100px; border-bottom: 1px solid #000;">&nbsp;</span>
                        </td>
                        <td style="border: none; padding: 4px 5px;">
                            <strong>Date:</strong> <span
                                style="display: inline-block; width: 80px; border-bottom: 1px solid #000;">&nbsp;</span>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <table class="items-table">
        <thead>
        <tr>
            <th style="width: 7%;">Item No.</th>
            <th style="width: 10%;">Unit</th>
            <th style="width: 50%;">Item Description</th>
            <th style="width: 8%;">Qty</th>
            <th style="width: 12%;">Unit Cost</th>
            <th style="width: 13%;">Total Cost</th>
        </tr>
        </thead>
        <tbody>
        @foreach($purchaseRequest->items as $index => $item)
            <tr>
                <td class="text-center">{{ $index + 1 }}</td>
                <td class="text-center">{{ $item->unit ?? 'Unit' }}</td>
                <td>
                    <p class="item-name">{{ $item->item_name }}</p>
                    <p class="item-desc">{{ $item->item_desc }}</p>
                </td>
                <td class="text-center">{{ $item->quantity }}</td>
                <td class="text-right">&#8369;{{ number_format($item->estimated_unit_cost, 2) }}</td>
                <td class="text-right">&#8369;{{ number_format($item->quantity * $item->estimated_unit_cost, 2) }}</td>
            </tr>
        @endforeach

        @if(count($purchaseRequest->items) < 3)
            @for ($i = 0; $i < (3 - count($purchaseRequest->items)); $i++)
                <tr>
                    <td style="min-height: 35px;">&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                </tr>
            @endfor
        @endif

        <tr class="total-row">
            <td colspan="5" class="text-right">TOTAL:</td>
            <td class="text-right">
                <span class="double-underline">&#8369;{{ number_format($grandTotal, 2) }}</span>
            </td>
        </tr>
        </tbody>
    </table>

    <div style="border-bottom: 1px solid #000000; padding: 10px; page-break-inside: avoid;">
        <div style="width: 45%; border: 1px solid #000000; padding: 8px; font-size: 10px; line-height: 1.4; margin: 0 auto;">
            <div style="font-weight: bold; font-size: 11px; text-align: center; margin-bottom: 5px; text-transform: uppercase;">
                City Budget Office
            </div>

            <table style="width: 100%; border-collapse: collapse; border: none;">
                <tr>
                    <td style="border: none; padding: 2px 0; white-space: nowrap; width: 130px;">Appropriation Ordinance No.:</td>
                    <td style="border: none; padding: 2px 0; border-bottom: 1px solid #000; vertical-align: bottom;">
                        &nbsp;{{ $purchaseRequest->budget_ordinance ?? '' }}
                    </td>
                </tr>
                <tr>
                    <td style="border: none; padding: 2px 0; white-space: nowrap;">Allotment Release Control No.:</td>
                    <td style="border: none; padding: 2px 0; border-bottom: 1px solid #000; vertical-align: bottom;">
                        &nbsp;{{ date('Y') }}-{{ $purchaseRequest->allotment_control_no ?? '' }}
                    </td>
                </tr>
            </table>

            <div style="margin-top: 2px; margin-bottom: 3px;">
                Account Charges: <br/>
                <span style="display: inline-block; width: 100%; border-bottom: 1px solid #000; vertical-align: bottom;">&nbsp;{{ $purchaseRequest->account_charges ?? '' }}</span>
            </div>

            <table style="width: 100%; border-collapse: collapse; border: none;">
                <tr>
                    <td style="border: none; padding: 2px 0; white-space: nowrap; width: 30px;">FPP:</td>
                    <td style="border: none; padding: 2px 0; border-bottom: 1px solid #000; vertical-align: bottom;">
                        &nbsp;{{ $purchaseRequest->fpp ?? '' }}
                    </td>
                </tr>
                <tr>
                    <td style="border: none; padding: 2px 0; white-space: nowrap;">Date:</td>
                    <td style="border: none; padding: 2px 0; border-bottom: 1px solid #000; vertical-align: bottom;">
                        &nbsp;{{ $purchaseRequest->budget_date ?? '' }}
                    </td>
                </tr>
            </table>

            <div style="text-align: center; margin-top: 10px;">
                <div style="font-size: 9px; margin-bottom: 15px; text-align: left; padding-left: 5px;">Certified By:</div>
                <div style="font-weight: bold; text-transform: uppercase; text-decoration: underline;">
                    @if(filled($sig['budget_officer']['name'])){{ $sig['budget_officer']['name'] }}@else&nbsp;@endif
                </div>
                <div style="font-size: 9px; margin-top: 2px; color: #000000;">
                    {{ $sig['budget_officer']['position'] }}
                </div>
            </div>
        </div>
    </div>

    <div style="page-break-inside: avoid;">
        <div class="purpose-box">
            <strong>Purpose:</strong> {{ $purchaseRequest->remarks_or_notes ?? '' }}
        </div>

        <table class="signatory-table">
            <thead>
            <tr>
                <th style="width: 33.33%;">Requested by:</th>
                <th style="width: 33.33%;">Cash Availability:</th>
                <th style="width: 33.34%;">Approved by:</th>
            </tr>
            </thead>
            <tbody>
            <tr>
                <td>
                    <div class="sig-name" style="text-decoration: none;">&nbsp;</div>
                    <div class="sig-name">@if(filled($purchaseRequest->requester_department)){{ $purchaseRequest->requester_department }}@else&nbsp;@endif</div>
                    <div class="sig-title">{{ $purchaseRequest->requester_designation ?? 'Requestor' }}</div>
                    <div class="sig-date" style="margin-top: 5px;">Date: {{ $purchaseRequest->created_at ? $purchaseRequest->created_at->format('M d, Y') : '' }}</div>
                </td>
                <td>
                    <div class="sig-name" style="text-decoration: none;">&nbsp;</div>
                    <div class="sig-name">@if(filled($sig['cash_availability']['name'])){{ $sig['cash_availability']['name'] }}@else&nbsp;@endif</div>
                    <div class="sig-title">{{ $sig['cash_availability']['position'] }}</div>
                    <div class="sig-date" style="margin-top: 5px;">Date: ________________________</div>
                </td>
                <td>
                    <div class="sig-name" style="text-decoration: none;">&nbsp;</div>
                    <div class="sig-name">@if(filled($sig['approved_by']['name'])){{ $sig['approved_by']['name'] }}@else&nbsp;@endif</div>
                    <div class="sig-title">{{ $sig['approved_by']['position'] }}</div>
                    <div class="sig-date" style="margin-top: 5px;">Date: ________________________</div>
                </td>
            </tr>
            </tbody>
        </table>
    </div>

</div>

</body>
</html>
