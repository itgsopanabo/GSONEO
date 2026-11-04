{{--
    A SQL console result as a printable report.

    $title, $description  from the page, or the saved query's name and description
    $headers, $rows        the query result
    $compact               true for wide results, which print in a smaller font
--}}
@php
    $cell = function ($value) {
        if ($value === null) {
            return '';
        }
        if (is_array($value) || is_object($value)) {
            $value = json_encode($value);
        }

        return nl2br(e((string) $value));
    };
    // Plain numbers (amounts, counts) line up on the right. A leading zero,
    // as in "00012", is a code rather than a number, so it stays on the left.
    $isNumber = fn ($value) => is_int($value) || is_float($value)
        || (is_string($value) && preg_match('/^-?(0|[1-9]\d*)(\.\d+)?$/', $value));
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <meta charset="utf-8">
    <title>{{ $title !== '' ? $title : 'Query result' }}</title>
    <style>
        @page {
            margin: 24px 28px;
        }

        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: {{ $compact ? '7.5px' : '9px' }};
            color: #000;
            line-height: 1.3;
        }

        .report-description {
            margin: 10px 0 0;
            text-align: center;
            font-size: {{ $compact ? '8.5px' : '9.5px' }};
        }

        .report-meta {
            margin: 6px 0 10px;
            text-align: center;
            font-size: 8px;
            color: #444;
        }

        table.result {
            width: 100%;
            border-collapse: collapse;
        }

        table.result th,
        table.result td {
            border: 1px solid #000;
            padding: {{ $compact ? '2px 3px' : '3px 5px' }};
            vertical-align: top;
            text-align: left;
            word-wrap: break-word;
        }

        table.result th {
            background: #eeeeee;
            font-weight: bold;
        }

        table.result td.num {
            text-align: right;
            white-space: nowrap;
        }

        table.result tr {
            page-break-inside: avoid;
        }

        .no-rows {
            margin-top: 16px;
            text-align: center;
            color: #444;
        }
    </style>
    @include('pdf.partials.branding-styles', ['pageBottom' => 24])
</head>
<body>
@include('pdf.partials.foreground')

@include('pdf.partials.letterhead', ['documentTitle' => $title])

@if($description !== '')
    <p class="report-description">{!! nl2br(e($description)) !!}</p>
@endif

<p class="report-meta">
    Generated {{ $generatedAt }}@if($generatedBy) by {{ $generatedBy }}@endif
    · {{ number_format($count) }} {{ $count === 1 ? 'row' : 'rows' }}
</p>

@if(empty($headers))
    <p class="no-rows">The query returned no rows.</p>
@else
    <table class="result">
        <thead>
        <tr>
            @foreach($headers as $header)
                <th>{{ $header }}</th>
            @endforeach
        </tr>
        </thead>
        <tbody>
        @foreach($rows as $row)
            @php $row = (array) $row; @endphp
            <tr>
                @foreach($headers as $header)
                    <td @class(['num' => $isNumber($row[$header] ?? null)])>{!! $cell($row[$header] ?? null) !!}</td>
                @endforeach
            </tr>
        @endforeach
        </tbody>
    </table>
@endif
</body>
</html>
