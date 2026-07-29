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

        .title {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>

<div class="title">INSPECTION AND ACCEPTANCE REPORT</div>

<!-- Header Details -->
<table class="header-table" width="100%">
    <tr>
        <td><strong>Supplier:</strong> {{ $purchaseOrder->PO_Supplier ?? '—' }}</td>
        <td><strong>IAR No.:</strong> {{ $purchaseOrder->id }}</td>
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
            <td style="text-align: center;">{{ $item->quantity }}</td>
            <td style="text-align: center;">{{ $item->unit ?? 'pcs' }}</td>
        </tr>
    @empty
        <tr>
            <td colspan="4" style="text-align: center;">No items selected for this report.</td>
        </tr>
    @endforelse
    </tbody>
</table>

</body>
</html>
