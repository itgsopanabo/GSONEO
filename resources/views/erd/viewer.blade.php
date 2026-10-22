<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ERD · {{ $database }}</title>
    <style>
        :root {
            --bg: #f8fafc; --panel: #ffffff; --ink: #0f172a; --muted: #64748b; --line: #e2e8f0;
            --accent: #4f46e5; --accent-soft: #eef2ff; --hl: #f59e0b;
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; height: 100%; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
        .app { display: grid; grid-template-columns: 300px 1fr; height: 100vh; }
        aside { background: var(--panel); border-right: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; }
        header.side { padding: 16px; border-bottom: 1px solid var(--line); }
        header.side h1 { font-size: 16px; margin: 0; }
        header.side p { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
        .search { margin-top: 12px; width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; font: inherit; }
        .search:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
        ul.tables { list-style: none; margin: 0; padding: 6px; overflow: auto; flex: 1; }
        ul.tables button { width: 100%; display: flex; justify-content: space-between; gap: 8px; text-align: left; padding: 7px 10px; border: 0; border-radius: 6px; background: none; font: inherit; color: var(--ink); cursor: pointer; }
        ul.tables button:hover { background: #f1f5f9; }
        ul.tables button[aria-current="true"] { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
        ul.tables small { color: var(--muted); font-weight: 400; }
        .details { border-top: 1px solid var(--line); padding: 12px 16px; max-height: 45vh; overflow: auto; font-size: 12px; }
        .details h2 { font-size: 13px; margin: 0 0 8px; font-family: ui-monospace, Consolas, monospace; }
        .details table { width: 100%; border-collapse: collapse; }
        .details td { padding: 3px 4px; border-bottom: 1px solid var(--line); vertical-align: top; }
        .details td:first-child { font-family: ui-monospace, Consolas, monospace; }
        .details .k { color: var(--accent); font-weight: 600; }
        .details .rel { margin-top: 10px; color: var(--muted); }
        .details .rel b { color: var(--ink); font-weight: 600; }
        main { position: relative; overflow: hidden; min-width: 0; }
        .toolbar { position: absolute; top: 12px; right: 12px; z-index: 5; display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
        .toolbar button { padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); font: inherit; font-size: 13px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
        .toolbar button:hover { background: #f1f5f9; }
        .toolbar .zoom { min-width: 56px; text-align: center; padding: 6px 8px; color: var(--muted); font-variant-numeric: tabular-nums; }
        #viewport { position: absolute; inset: 0; cursor: grab; touch-action: none; }
        #viewport.dragging { cursor: grabbing; }
        #canvas { transform-origin: 0 0; position: absolute; top: 0; left: 0; }
        #status { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); padding: 24px; text-align: center; }
        .hint { position: absolute; left: 12px; bottom: 12px; color: var(--muted); font-size: 12px; background: rgba(255,255,255,.85); padding: 4px 8px; border-radius: 6px; }
        svg .erd-highlight rect, svg .erd-highlight path { stroke: var(--hl) !important; stroke-width: 3px !important; }
        @media (max-width: 760px) {
            .app { grid-template-columns: 1fr; grid-template-rows: 45vh 1fr; }
            aside { border-right: 0; border-bottom: 1px solid var(--line); }
        }
    </style>
</head>
<body>
<div class="app">
    <aside>
        <header class="side">
            <h1>Entity Relationship Diagram</h1>
            <p>{{ $database }} · {{ count($tables) }} tables · {{ count($relationships) }} relationships<br>Generated {{ $generatedAt }}</p>
            <input id="search" class="search" type="search" placeholder="Find a table or column…" aria-label="Find a table or column">
        </header>
        <ul class="tables" id="tables"></ul>
        <section class="details" id="details" hidden></section>
    </aside>
    <main>
        <div class="toolbar">
            <button type="button" id="zoomOut" aria-label="Zoom out">−</button>
            <span class="zoom" id="zoomLabel">100%</span>
            <button type="button" id="zoomIn" aria-label="Zoom in">+</button>
            <button type="button" id="fit">Fit</button>
            <button type="button" id="actual">100%</button>
            <button type="button" id="svgDownload">Download SVG</button>
            <button type="button" id="pngDownload">Download PNG</button>
        </div>
        <div id="viewport"><div id="canvas"></div></div>
        <div id="status">Rendering diagram…</div>
        <div class="hint">Drag to pan · scroll to zoom · click a table in the list to jump to it</div>
    </main>
</div>

<script type="module">
    // Mermaid comes from the app's own build (see resources/js/erd-mermaid.js), not a
    // CDN, so the ERD opens with no internet. Imported below, where a failure to load
    // it — assets not built yet — can be shown in the status line.
    const mermaidUrl = @json($mermaidUrl);

    const diagram = @json($mermaid);
    const tables = @json($tables);
    const relationships = @json($relationships);

    const $ = (id) => document.getElementById(id);
    const viewport = $('viewport'), canvas = $('canvas'), status = $('status');
    let scale = 1, x = 0, y = 0, svgEl = null, current = null;

    const apply = () => {
        canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        $('zoomLabel').textContent = Math.round(scale * 100) + '%';
    };

    const zoomAt = (factor, cx, cy) => {
        const next = Math.min(4, Math.max(0.05, scale * factor));
        x = cx - (cx - x) * (next / scale);
        y = cy - (cy - y) * (next / scale);
        scale = next;
        apply();
    };

    const size = () => {
        const box = svgEl.viewBox.baseVal;
        return { w: box?.width || svgEl.getBBox().width, h: box?.height || svgEl.getBBox().height };
    };

    const fit = () => {
        const { w, h } = size();
        const r = viewport.getBoundingClientRect();
        // Layout may not be ready on the first frame; try again on the next one.
        if (r.width < 50 || r.height < 50) return requestAnimationFrame(fit);
        scale = Math.max(0.05, Math.min((r.width - 40) / w, (r.height - 40) / h, 1));
        x = (r.width - w * scale) / 2;
        y = (r.height - h * scale) / 2;
        apply();
    };

    // Mermaid ids entity groups "<renderId>-entity-<table>-<n>" (older versions drop the prefix).
    const entityGroup = (name) =>
        [...svgEl.querySelectorAll('g[id*="entity-"]')].find((g) => g.id.match(/entity-(.+)-\d+$/)?.[1] === name);

    const focusTable = (name) => {
        const group = entityGroup(name);
        svgEl.querySelectorAll('.erd-highlight').forEach((g) => g.classList.remove('erd-highlight'));
        if (!group) return;
        group.classList.add('erd-highlight');

        // Screen rectangles already include every transform, so convert them
        // back to unscaled canvas units before re-centring.
        const g = group.getBoundingClientRect();
        const s = svgEl.getBoundingClientRect();
        const cx = (g.left - s.left + g.width / 2) / scale;
        const cy = (g.top - s.top + g.height / 2) / scale;
        const r = viewport.getBoundingClientRect();
        scale = Math.min(1.2, Math.max(0.6, scale));
        x = r.width / 2 - cx * scale;
        y = r.height / 2 - cy * scale;
        apply();
    };

    const text = (value) => document.createTextNode(value ?? '');
    const el = (tag, children = [], attrs = {}) => {
        const node = Object.assign(document.createElement(tag), attrs);
        children.forEach((c) => node.append(typeof c === 'string' ? text(c) : c));
        return node;
    };

    const showDetails = (name) => {
        const t = tables[name];
        const box = $('details');
        box.replaceChildren();
        box.hidden = false;
        box.append(el('h2', [name]));
        const rows = t.columns.map((c) => el('tr', [
            el('td', [c.name]),
            el('td', [c.type + (c.nullable ? ' · null' : '')]),
            el('td', [c.keys.join(' ')], { className: 'k' }),
        ]));
        box.append(el('table', rows));
        const rels = relationships.filter((r) => r.parent === name || r.child === name);
        if (rels.length) {
            box.append(el('div', rels.map((r) => el('div', [
                el('b', [r.child]), `.${r.columns.join(', ')} → `, el('b', [r.parent]), `.${r.parentColumns.join(', ')}`,
            ])), { className: 'rel' }));
        }
    };

    const select = (name) => {
        current = name;
        document.querySelectorAll('#tables button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.table === name)));
        showDetails(name);
        focusTable(name);
    };

    const renderList = (query = '') => {
        const q = query.trim().toLowerCase();
        const items = Object.keys(tables)
            .filter((name) => !q || name.toLowerCase().includes(q) || tables[name].columns.some((c) => c.name.toLowerCase().includes(q)))
            .map((name) => {
                const button = el('button', [name, el('small', [String(tables[name].columns.length)])], { type: 'button' });
                button.dataset.table = name;
                button.setAttribute('aria-current', String(name === current));
                button.addEventListener('click', () => select(name));
                return el('li', [button]);
            });
        $('tables').replaceChildren(...items);
    };

    const download = (blob, filename) => {
        const a = el('a', [], { href: URL.createObjectURL(blob), download: filename });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    const svgString = () => new XMLSerializer().serializeToString(svgEl);

    try {
        await import(mermaidUrl);
        const mermaid = window.mermaid;
        if (!mermaid) throw new Error('Mermaid did not load from ' + mermaidUrl);
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false, er: { useMaxWidth: false }, maxTextSize: 500000 });
        const { svg } = await mermaid.render('erd', diagram);
        canvas.innerHTML = svg;
        svgEl = canvas.querySelector('svg');
        const { w, h } = size();
        svgEl.setAttribute('width', w);
        svgEl.setAttribute('height', h);
        svgEl.style.maxWidth = 'none';
        status.remove();
        renderList();
        fit();
    } catch (error) {
        status.textContent = 'Could not render the diagram: ' + error.message
            + '. If Mermaid itself failed to load, the frontend assets need building (npm run build).'
            + ' Either way, docs/erd/erd.mmd holds the diagram and opens in any Mermaid tool.';
    }

    $('search').addEventListener('input', (e) => renderList(e.target.value));
    $('zoomIn').addEventListener('click', () => { const r = viewport.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); });
    $('zoomOut').addEventListener('click', () => { const r = viewport.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); });
    $('fit').addEventListener('click', () => svgEl && fit());
    $('actual').addEventListener('click', () => { const r = viewport.getBoundingClientRect(); zoomAt(1 / scale, r.width / 2, r.height / 2); });

    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = viewport.getBoundingClientRect();
        zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    let drag = null;
    viewport.addEventListener('pointerdown', (e) => { drag = { sx: e.clientX - x, sy: e.clientY - y }; viewport.setPointerCapture(e.pointerId); viewport.classList.add('dragging'); });
    viewport.addEventListener('pointermove', (e) => { if (!drag) return; x = e.clientX - drag.sx; y = e.clientY - drag.sy; apply(); });
    const endDrag = () => { drag = null; viewport.classList.remove('dragging'); };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    $('svgDownload').addEventListener('click', () => svgEl && download(new Blob([svgString()], { type: 'image/svg+xml' }), 'erd.svg'));
    $('pngDownload').addEventListener('click', () => {
        if (!svgEl) return;
        const { w, h } = size();
        const img = new Image();
        img.onload = () => {
            const c = el('canvas', [], { width: w * 2, height: h * 2 });
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
            ctx.scale(2, 2); ctx.drawImage(img, 0, 0, w, h);
            c.toBlob((blob) => download(blob, 'erd.png'));
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString());
    });
</script>
</body>
</html>
