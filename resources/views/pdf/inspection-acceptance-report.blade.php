<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Inspection and Acceptance Report</title>
    <style>
        body {
            font-family: sans-serif;
            font-size: 12px;
        }

        .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }

        .table th, .table td {
            border: 1px solid #ddd;
            padding: 6px;
        }

        .header-table td {
            border: none;
            padding: 3px 0;
        }

        .iar-letterhead {
            margin-bottom: 16px;
        }

        .sig-table {
            width: 100%;
            margin-top: 40px;
            border-collapse: collapse;
            table-layout: fixed;
            page-break-inside: avoid;
        }

        .sig-table td {
            width: 50%;
            padding: 0 24px;
            vertical-align: top;
        }

        .sig-label {
            font-size: 11px;
        }

        .sig-name {
            margin-top: 36px;
            padding-bottom: 2px;
            border-bottom: 1px solid #000;
            text-align: center;
            font-weight: bold;
            text-transform: uppercase;
        }

        .sig-pos {
            margin-top: 3px;
            text-align: center;
            font-size: 10px;
        }

        .sig-date {
            margin-top: 10px;
            font-size: 10px;
        }

        .acceptance-table {
            margin-top: 12px;
            font-size: 11px;
        }

        .acceptance-table td {
            padding-right: 18px;
        }

        .check-box {
            display: inline-block;
            width: 11px;
            height: 11px;
            border: 1px solid #000;
            text-align: center;
            line-height: 11px;
            font-size: 9px;
            font-weight: bold;
            vertical-align: middle;
        }
    </style>
    @include('pdf.partials.branding-styles')
</head>
<body>
@include('pdf.partials.foreground')

@include('pdf.partials.letterhead', ['documentTitle' => 'Inspection and Acceptance Report', 'class' => 'iar-letterhead'])

<!-- Header Details -->
<table class="header-table" width="100%">
    <tr>
        <td><strong>Supplier:</strong> {{ $purchaseOrder->PO_Supplier ?? '—' }}</td>
        <td><strong>IAR No.:</strong> {{ $iarNumber }}</td>
    </tr>
    <tr>
        <td><strong>PO No.:</strong> {{ $purchaseOrder->PO_Number ?? $purchaseOrder->id }}</td>
        <td><strong>Date:</strong> {{ \Carbon\Carbon::parse($purchaseOrder->PO_Date)->format('F d, Y') }}</td>
    </tr>
    <!-- INVOICE DETAILS HERE -->
    <tr>
        <td><strong>Invoice No.:</strong> {{ $invoiceNumber }}</td>
        <td><strong>Invoice Date:</strong> {{ $invoiceDate }}</td>
    </tr>
</table>

<!-- Items Table -->
<table class="table">
    <thead>
    <tr style="background-color: #f3f4f6;">
        <th style="width: 10%;">Item No.</th>
        <th style="width: 50%;">Description</th>
        <th style="width: 20%;">Quantity</th>
        <th style="width: 20%;">Unit</th>
    </tr>
    </thead>
    <tbody>
    @forelse($items as $index => $item)
        <tr>
            <td style="text-align: center;">{{ $loop->iteration }}</td>
            <td>
                <strong>{{ $item->item_name ?? $item->product_id }}</strong>
                @if($item->item_desc)
                    <br><small style="color: #666;">{{ $item->item_desc }}</small>
                @endif
            </td>
            <td style="text-align: center;">
                {{ $item->quantity }}
                {{-- On a partial delivery, the line may be short of what was ordered. --}}
                @if(isset($item->quantity_ordered) && $item->quantity_ordered != $item->quantity)
                    <br><small style="color: #666;">of {{ $item->quantity_ordered }} ordered</small>
                @endif
            </td>
            <td style="text-align: center;">{{ $item->unit ?? 'pcs' }}</td>
        </tr>
    @empty
        <tr>
            <td colspan="4" style="text-align: center;">No items selected for this report.</td>
        </tr>
    @endforelse
    </tbody>
</table>

<!-- Acceptance: complete or partial, as recorded when the report was generated -->
<table class="acceptance-table">
    <tr>
        <td><strong>Acceptance:</strong></td>
        <td><span class="check-box">{{ $deliveryStatus === 'complete' ? 'X' : '' }}</span> Complete</td>
        <td><span class="check-box">{{ $deliveryStatus === 'partial' ? 'X' : '' }}</span> Partial (quantities as specified above)</td>
    </tr>
</table>

<!-- Signatories -->
@php $sig = $signatories['iar']['slots']; @endphp
<table class="sig-table">
    <tr>
        @foreach(['inspected_by', 'accepted_by'] as $slot)
            <td>
                <div class="sig-label">{{ $sig[$slot]['label'] }}:</div>
                {{-- No name set: a line to sign on. --}}
                <div class="sig-name">@if(filled($sig[$slot]['name'])){{ $sig[$slot]['name'] }}@else&nbsp;@endif</div>
                <div class="sig-pos">{{ $sig[$slot]['position'] }}</div>
                <div class="sig-date">Date: ____________________</div>
            </td>
        @endforeach
    </tr>
</table>

</body>
</html>
