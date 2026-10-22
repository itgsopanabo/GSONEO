{{--
    Styles for the shared letterhead, footer and watermark. Include inside <head>,
    after the document's own <style>, so the footer's page margin wins.

    $pageBottom  the document's own bottom page margin in px, kept when the
                 footer needs less room than that.
--}}
@php
    $footerLines = count($branding['footer_lines']) + ($branding['footer_page_numbers'] ? 1 : 0);
    // Room for the footer below the content: its lines plus some breathing space.
    $footerRoom = $footerLines ? 16 + 11 * $footerLines : 0;
@endphp
<style>
    @if($footerRoom)
    @page {
        margin-bottom: {{ max($footerRoom, $pageBottom ?? 0) }}px !important;
    }
    @endif

    /* ---------- Letterhead ---------- */
    table.doc-letterhead {
        width: 100%;
        border-collapse: collapse;
        @if($branding['header_rule'])
        border-bottom: 2px solid {{ $branding['accent_color'] }};
        @endif
    }

    table.doc-letterhead td {
        vertical-align: middle;
        padding: 5px 6px;
    }

    .doc-lh-side {
        width: 20%;
        text-align: center;
    }

    .doc-lh-side img {
        height: {{ $branding['logo_size'] }}px;
        width: auto;
    }

    .doc-lh-center {
        width: 60%;
        text-align: center;
        line-height: 1.35;
    }

    .doc-lh-line {
        font-size: 10.5px;
    }

    .doc-lh-office {
        margin-top: 2px;
        font-size: 12.5px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: .3px;
        color: {{ $branding['accent_color'] }};
    }

    .doc-lh-title {
        margin-top: 6px;
        font-size: 15px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: {{ $branding['accent_color'] }};
    }

    .doc-lh-motto {
        margin-top: 3px;
        font-size: 9px;
        font-style: italic;
        line-height: 1.4;
    }

    /* ---------- Footer ---------- */
    .doc-footer {
        position: fixed;
        left: 0;
        right: 0;
        bottom: -{{ $footerRoom - 6 }}px;
        height: {{ $footerRoom - 10 }}px;
        border-top: 1px solid {{ $branding['accent_color'] }};
        padding-top: 3px;
        text-align: center;
        /* Bundled with dompdf and carries the ☎ and ✉ symbols. */
        font-family: 'DejaVu Sans', sans-serif;
        font-size: 8px;
        line-height: 11px;
        color: #333333;
    }

    .doc-footer .doc-page-number:after {
        /* dompdf has no counter(pages), so no "of N". */
        content: "Page " counter(page);
    }

    /* ---------- Watermark, laid over every page ---------- */
    .doc-watermark {
        position: fixed;
        left: 0;
        right: 0;
        top: 30%;
        text-align: center;
        z-index: 1000;
        opacity: {{ $branding['watermark_opacity'] }};
    }

    .doc-watermark img {
        width: {{ $branding['watermark_size'] }}px;
        height: auto;
    }

    .doc-watermark-text {
        margin-top: 80px;
        font-weight: bold;
        white-space: nowrap;
        color: {{ $branding['accent_color'] }};
        font-size: {{ round($branding['watermark_size'] / max(4, mb_strlen($branding['watermark_text']) * 0.62)) }}px;
        transform: rotate(-30deg);
    }
</style>
