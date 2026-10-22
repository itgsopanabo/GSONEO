import { useEffect, useState } from 'react';

/**
 * Renders the ```mermaid fences inside a server-rendered markdown container as
 * actual diagrams.
 *
 * The markdown files under docs/ stay the source of truth — GitHub renders the
 * same fences natively, and this only turns them into pictures inside the app,
 * where the markdown arrives as plain <pre><code class="language-mermaid">.
 *
 * Mermaid is imported on demand, so its bundle is fetched only on a page that
 * actually contains a diagram — it never weighs on the rest of the app.
 */

/** Render ids must be unique per call, or a re-render reuses stale definitions. */
let sequence = 0;

/**
 * Mermaid's stock themes (lilac boxes, yellow groups) sit badly on the docs card,
 * so the diagrams borrow the app's own palette: indigo accents on Tailwind grays,
 * checked against the white card in light mode and the gray-800 one in dark.
 */
const PALETTE = {
    light: {
        primaryColor: '#eef2ff', // indigo-50 node fill
        primaryBorderColor: '#6366f1', // indigo-500
        primaryTextColor: '#1f2937', // gray-800
        lineColor: '#9ca3af', // gray-400
        clusterBkg: '#f9fafb', // gray-50 group fill
        clusterBorder: '#d1d5db', // gray-300
        tertiaryColor: '#f3f4f6',
        textColor: '#374151', // gray-700, used by edge and group labels
        edgeLabelBackground: '#ffffff',
    },
    dark: {
        primaryColor: '#374151', // gray-700
        primaryBorderColor: '#818cf8', // indigo-400
        primaryTextColor: '#f3f4f6', // gray-100
        lineColor: '#6b7280', // gray-500
        clusterBkg: '#111827', // gray-900
        clusterBorder: '#4b5563', // gray-600
        tertiaryColor: '#1f2937',
        textColor: '#e5e7eb', // gray-200
        edgeLabelBackground: '#1f2937',
    },
};

/** Same class-based dark mode the dashboard charts watch (`.dark` on <html>). */
function useDarkMode() {
    const read = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const [dark, setDark] = useState(read);

    useEffect(() => {
        const observer = new MutationObserver(() => setDark(read()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    return dark;
}

/**
 * @param containerRef ref to the element holding the rendered markdown
 * @param documentKey  changes when a different document is shown, so its diagrams are drawn
 */
export default function useMermaidDiagrams(containerRef, documentKey) {
    const dark = useDarkMode();

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Fences not drawn yet, plus diagrams already drawn — the second group is
        // what lets a theme change redraw them, since the fence is gone by then.
        const targets = [
            ...container.querySelectorAll('pre > code.language-mermaid'),
            ...container.querySelectorAll('figure[data-mermaid]'),
        ];
        if (targets.length === 0) return;

        let cancelled = false;

        (async () => {
            const { default: mermaid } = await import('mermaid');
            if (cancelled) return;

            mermaid.initialize({
                startOnLoad: false,
                // Matches the generated ERD viewer: labels are treated as text, never markup.
                securityLevel: 'strict',
                htmlLabels: false,
                theme: 'base',
                themeVariables: {
                    ...(dark ? PALETTE.dark : PALETTE.light),
                    background: 'transparent',
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                    fontSize: '14px',
                },
                flowchart: { useMaxWidth: true, curve: 'basis', padding: 12 },
            });

            for (const target of targets) {
                const isFence = target.tagName === 'CODE';
                const source = isFence ? target.textContent : target.dataset.mermaid;
                const replaces = isFence ? target.parentElement : target;
                if (!source?.trim() || !replaces) continue;

                const id = `doc-diagram-${sequence++}`;

                try {
                    const { svg } = await mermaid.render(id, source);
                    if (cancelled) return;

                    const figure = document.createElement('figure');
                    figure.className = 'doc-diagram';
                    // Kept so the diagram can be drawn again when the theme flips.
                    figure.dataset.mermaid = source;
                    figure.innerHTML = svg;
                    replaces.replaceWith(figure);
                } catch (error) {
                    // A diagram the app can't draw is left as its source text, which is
                    // still readable, rather than blanking the section it belongs to.
                    console.error('Could not render a documentation diagram.', error);
                    // Mermaid leaves its scratch element behind when a render throws.
                    document.getElementById(`d${id}`)?.remove();
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [containerRef, documentKey, dark]);
}
