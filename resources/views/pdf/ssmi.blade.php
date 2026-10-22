<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <meta charset="utf-8">
    <title>{{ $purchaseOrder->SSMI_Number }}</title>
    <style>
        @page {
            margin: 18px 22px;
        }

        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 9px;
            color: #000;
            line-height: 1.25;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        /* ---------- Letterhead: the shared one, framed; the title band closes it ---------- */
        table.doc-letterhead.ssmi-letterhead {
            border: 1px solid #000;
            border-bottom: none;
        }

        /* ---------- Title band ---------- */
        .title-band {
            border: 1px solid #000;
            table-layout: fixed;
        }

        .title-band > tr > td,
        .title-band td.tb-left,
        .title-band td.tb-center,
        .title-band td.tb-right {
            padding: 5px 8px;
            vertical-align: top;
        }

        /* side columns MUST be equal or the centre column is not page-centred */
        .tb-left {
            width: 27%;
            font-size: 8.5px;
            line-height: 1.7;
        }

        .tb-right {
            width: 27%;
            font-size: 9px;
        }

        .tb-note {
            line-height: 1.6;
        }

        /* ----- period line ----- */
        .period-table {
            width: auto;
            margin-top: 3px;
            border-collapse: collapse;
        }

        .period-table td {
            padding: 0;
            font-size: 8.5px;
            white-space: nowrap;
            vertical-align: bottom;
        }

        .period-lbl {
            padding-right: 7px;
        }

        .period-sep {
            padding: 0 7px;
            text-align: center;
        }

        .period-val {
            border-bottom: 1px solid #000;
            min-width: 48px;
            padding: 0 3px 1px;
            text-align: center;
            font-weight: bold;
        }

        .period-year {
            padding-left: 6px;
        }

        /* ----- annex / SVP / reference numbers ----- */
        .tb-annex {
            text-align: right;
            font-size: 9px;
        }

        .tb-svp {
            text-align: center;
            font-size: 9px;
            padding-right: 20px;
        }

        .ref-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 2px;
        }

        .ref-table td {
            padding: 1px 0;
            font-size: 9px;
            white-space: nowrap;
            vertical-align: bottom;
        }

        .ref-lbl {
            font-weight: bold;
            padding-right: 6px;
            text-align: right;
            width: 38%;
        }

        .ref-val {
            border-bottom: 1px solid #000;
            padding: 0 4px 1px;
            text-align: center;
            font-weight: bold;
        }

        /* ----- centre title ----- */
        .tb-center {
            width: 46%;
            text-align: center;
        }

        .tb-center .doc-title {
            font-size: 10.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            white-space: nowrap;
        }

        .tb-center .doc-sub {
            font-size: 11px;
            font-weight: bold;
            letter-spacing: 1px;
            margin-top: 12px;
            text-transform: uppercase;
        }

        /* ---------- Items ---------- */
        .items-table {
            border: 1px solid #000;
            border-top: none;
        }

        .items-table th,
        .items-table td {
            border: 1px solid #000;
            padding: 3px 4px;
        }

        .items-table th {
            text-align: center;
            font-weight: bold;
            font-size: 8.5px;
            line-height: 1.2;
        }

        .items-table th.item-head {
            font-size: 13px;
            letter-spacing: 6px;
        }

        .items-table td {
            height: 17px;
            font-size: 9px;
        }

        .text-center {
            text-align: center;
        }

        .text-right {
            text-align: right;
        }

        .total-row td {
            font-weight: bold;
            height: 20px;
        }

        /* ---------- Signatories ---------- */
        .sig-table {
            border: 1px solid #000;
            border-top: none;
            table-layout: fixed;
        }

        .sig-table td {
            border-right: 1px solid #000;
            padding: 4px 8px 6px;
            vertical-align: top;
            height: 62px;
        }

        .sig-table td:last-child {
            border-right: none;
        }

        .sig-label {
            font-size: 9px;
        }

        .sig-name {
            text-align: center;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 26px;
        }

        .sig-pos {
            text-align: center;
            font-size: 8.5px;
            text-transform: uppercase;
        }

        .sig-line {
            border-top: 1px solid #000;
            margin: 34px 14px 3px;
        }

        /* ---------- Notes ---------- */
        .notes-table {
            margin-top: 4px;
        }

        .notes-table td {
            font-size: 8.5px;
            vertical-align: top;
            padding: 1px 2px;
        }

        .sof {
            text-align: right;
            font-size: 9px;
        }
    </style>
    @include('pdf.partials.branding-styles', ['pageBottom' => 18])
</head>
<body>
@include('pdf.partials.foreground')
@php $sig = $signatories['ssmi']['slots']; @endphp

{{-- ============ LETTERHEAD ============ --}}
@include('pdf.partials.letterhead', ['class' => 'ssmi-letterhead'])

{{-- ============ TITLE BAND ============ --}}
<table class="title-band">
    <tr>
        <td class="tb-left">
            <div class="tb-note">(from all RIS received by GSO)</div>
            {{-- The LGU is the last line of the letterhead, e.g. "City of Panabo". --}}
            <div class="tb-note">LGU: <strong>{{ last($branding['header_lines'] ?? []) ?: '' }}</strong></div>
            <table class="period-table">
                <tr>
                    <td class="period-lbl">For the Period</td>
                    <td class="period-val">{{ $periodFrom }}</td>
                    <td class="period-sep">to</td>
                    <td class="period-val">{{ $periodTo }}</td>
                    <td class="period-year">of {{ $periodYear }}</td>
                </tr>
            </table>
        </td>

        <td class="tb-center">
            <div class="doc-title">Summary of Supplies and Materials Issued</div>
            <div class="doc-sub">{{ $officeCode ?: ' ' }}</div>
        </td>

        <td class="tb-right">
            <div class="tb-annex">Annex 35</div>

        <table class="ref-table">
            <tr>
                <td class="ref-lbl">Proc.Mode:</td>
                <td class="ref-val">{{ $procurementMode ?? '' }}</td>
            </tr>
            <tr>

                <td class="ref-lbl">SSMI NO:</td>
                <td class="ref-val">{{ $purchaseOrder->SSMI_Number ?? '' }}</td>
            </tr>
            <tr>
                <td class="ref-lbl">RIS NO:</td>
                <td class="ref-val">{{ $purchaseOrder->RIS_Number ?? '' }}</td>
            </tr>
        </table>
        </td>
    </tr>
</table>

{{-- ============ ITEMS ============ --}}
@php
    $minRows = 14;
    // One issue slip per order: the first column carries its number and
    // quantities, the rest stay blank as on the printed form.
    $risCols = 4;
    $risNumber = $purchaseOrder->RIS_Number ?? '';
    // Split before the sequence so "RIS-2026-0004" fits its narrow column.
    $risHead = str_contains($risNumber, '-')
        ? e(\Illuminate\Support\Str::beforeLast($risNumber, '-')).'-<br>'.e(\Illuminate\Support\Str::afterLast($risNumber, '-'))
        : e($risNumber);
@endphp

<table class="items-table">
    <thead>
    <tr>
        <th class="item-head" colspan="2" style="width:44%;">ITEM</th>
        <th rowspan="2" style="width:7%;">Unit<br>of<br>Measure</th>
        <th colspan="{{ $risCols }}" style="width:18%;">Requisition and Issue<br>Slip Numbers<br>Quantity Issued</th>
        <th rowspan="2" style="width:9%;">Total<br>Quantity<br>Issued</th>
        <th rowspan="2" style="width:10%;">UNIT<br>COST</th>
        <th rowspan="2" style="width:12%;">TOTAL<br>COST</th>
    </tr>
    <tr>
        <th style="width:4%;">No.</th>
        <th style="width:40%;">Description</th>
        <th style="width:9%; font-size:7px;">{!! $risHead !!}</th>
        @for($c = 2; $c <= $risCols; $c++)
            <th style="width:3%;"></th>
        @endfor
    </tr>
    </thead>
    <tbody>
    @forelse($items as $item)
        <tr>
            <td class="text-center">{{ $loop->iteration }}</td>
            <td>{{ $item->item_desc ?? $item->item_name ?? '' }}</td>
            <td class="text-center">{{ $item->unit ?? '' }}</td>
            <td class="text-center">{{ number_format($item->quantity_issued) }}</td>
            @for($c = 2; $c <= $risCols; $c++)
                <td></td>
            @endfor
            <td class="text-center">{{ number_format($item->quantity_issued) }}</td>
            <td class="text-right">{{ number_format($item->unit_cost, 2) }}</td>
            <td class="text-right">{{ number_format($item->total_cost, 2) }}</td>
        </tr>
    @empty
    @endforelse

    {{-- blank filler rows so the form keeps its printed height --}}
    @for($r = $items->count(); $r < $minRows; $r++)
        <tr>
            <td>&nbsp;</td>
            <td></td>
            <td></td>
            @for($c = 1; $c <= $risCols; $c++)
                <td></td>
            @endfor
            <td></td>
            <td></td>
            <td></td>
        </tr>
    @endfor

    <tr class="total-row">
        <td colspan="{{ 3 + $risCols }}" style="border-right:none;"></td>
        <td class="text-right" colspan="2" style="border-left:none;">TOTAL:</td>
        <td class="text-right">{{ number_format($grandTotal, 2) }}</td>
    </tr>
    </tbody>
</table>

{{-- ============ SIGNATORIES ============ --}}
<table class="sig-table">
    <tr>
        @foreach(['prepared_by' => ['Prepared by:', '34%'], 'certified_by' => ['Certified by:', '34%'], 'posted_by' => ['Posted in the SLC by/date:', '32%']] as $slot => [$label, $width])
            <td style="width:{{ $width }};">
                <div class="sig-label">{{ $label }}</div>
                {{-- No name set: a line to sign on. --}}
                @if(filled($sig[$slot]['name']))
                    <div class="sig-name">{{ $sig[$slot]['name'] }}</div>
                @else
                    <div class="sig-line"></div>
                @endif
                <div class="sig-pos">{{ $sig[$slot]['position'] }}</div>
            </td>
        @endforeach
    </tr>
</table>

{{-- ============ NOTES ============ --}}
<table class="notes-table">
    <tr>
        <td style="width:60%;">
            Forwarded to Accounting<br>
            should be reconciled with SSMI of GSO
        </td>
        <td class="sof" style="width:40%;">
            {{-- SSMIs numbered before the fund was recorded print a line to fill in. --}}
            SOURCE OF FUND: <strong>{{ $sourceOfFund ?? '____________' }}</strong>
        </td>
    </tr>
</table>

{{-- ============ FOOTER ============ --}}
</body>
</html>
