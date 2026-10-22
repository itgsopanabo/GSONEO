{{--
    The letterhead set on the Document Branding screen.

    $documentTitle  optional, printed under the office name, e.g. PURCHASE REQUEST
    $class          optional extra class, for a document that frames the letterhead
--}}
<table class="doc-letterhead {{ $class ?? '' }}">
    <tr>
        <td class="doc-lh-side">
            @if($branding['left_logo'])
                <img src="{{ $branding['left_logo'] }}" alt="Logo">
            @endif
        </td>
        <td class="doc-lh-center">
            @foreach($branding['header_lines'] as $line)
                <div class="doc-lh-line">{{ $line }}</div>
            @endforeach
            @if($branding['office_name'] !== '')
                <div class="doc-lh-office">{{ $branding['office_name'] }}</div>
            @endif
            @if(filled($documentTitle ?? null))
                <div class="doc-lh-title">{{ $documentTitle }}</div>
            @endif
        </td>
        <td class="doc-lh-side">
            @if($branding['right_logo'])
                <img src="{{ $branding['right_logo'] }}" alt="Logo">
            @endif
            @if($branding['motto'])
                <div class="doc-lh-motto">
                    @foreach($branding['motto'] as $line)
                        {{ $line }}@if(! $loop->last)<br>@endif
                    @endforeach
                </div>
            @endif
        </td>
    </tr>
</table>
