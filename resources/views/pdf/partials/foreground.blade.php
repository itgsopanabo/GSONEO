{{--
    The footer and watermark. Include right after <body>: dompdf repeats fixed
    elements only on the pages from where they first appear.
--}}
@if($branding['footer_lines'] || $branding['footer_page_numbers'])
    <div class="doc-footer">
        @foreach($branding['footer_lines'] as $line)
            <div>{{ $line }}</div>
        @endforeach
        @if($branding['footer_page_numbers'])
            <div class="doc-page-number"></div>
        @endif
    </div>
@endif

@if($branding['watermark'] === 'image' && $branding['watermark_image'])
    <div class="doc-watermark"><img src="{{ $branding['watermark_image'] }}" alt=""></div>
@elseif($branding['watermark'] === 'text' && $branding['watermark_text'] !== '')
    <div class="doc-watermark"><div class="doc-watermark-text">{{ $branding['watermark_text'] }}</div></div>
@endif
