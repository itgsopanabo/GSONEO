<!DOCTYPE html>
<html lang="en">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <meta charset="utf-8">
    <title>Document branding preview</title>
    <style>
        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 10px;
            color: #000000;
        }

        .note {
            margin: 12px 0;
            color: #555555;
        }

        .sample {
            width: 100%;
            border-collapse: collapse;
        }

        .sample th, .sample td {
            border: 1px solid #000000;
            padding: 5px;
        }

        .sample th {
            text-transform: uppercase;
            font-size: 9px;
        }
    </style>
    @include('pdf.partials.branding-styles')
</head>
<body>
@include('pdf.partials.foreground')

@include('pdf.partials.letterhead', ['documentTitle' => 'Sample Document'])

<p class="note">
    This sample shows the letterhead, footer and watermark as they print on every
    generated document. The rows below run onto a second page so the repeated
    footer and watermark can be checked too.
</p>

<table class="sample">
    <thead>
    <tr>
        <th style="width: 8%;">No.</th>
        <th style="width: 12%;">Unit</th>
        <th>Description</th>
        <th style="width: 10%;">Qty</th>
        <th style="width: 15%;">Amount</th>
    </tr>
    </thead>
    <tbody>
    @for($i = 1; $i <= 45; $i++)
        <tr>
            <td style="text-align: center;">{{ $i }}</td>
            <td style="text-align: center;">pcs</td>
            <td>Sample item description {{ $i }}</td>
            <td style="text-align: center;">{{ ($i % 7) + 1 }}</td>
            <td style="text-align: right;">&#8369;{{ number_format((($i % 7) + 1) * 125.5, 2) }}</td>
        </tr>
    @endfor
    </tbody>
</table>

</body>
</html>
