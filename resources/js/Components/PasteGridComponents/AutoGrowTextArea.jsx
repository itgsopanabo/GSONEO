import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Textarea that grows to fit its content.
 *
 * Specifications are the one field with no predictable length — a row can be
 * a single line or eight lines of bullet points off a scanned PR — so a fixed
 * height either wastes space on short rows or hides text on long ones. This
 * measures after every change and sets the height to match, capping at
 * maxRows so one enormous entry can't push the rest of the grid off screen.
 */
const AutoGrowTextarea = forwardRef(function AutoGrowTextarea(
    { value, minRows = 1, maxRows = 10, className = '', ...rest },
    ref,
) {
    const innerRef = useRef(null);

    // The parent needs this node for focus management, and so does the
    // measuring below, so the ref is handed to both.
    const setRefs = useCallback(node => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
    }, [ref]);

    const resize = useCallback(() => {
        const el = innerRef.current;
        if (!el) return;

        // Collapse first, or scrollHeight only ever reports the current height.
        el.style.height = 'auto';

        const styles = window.getComputedStyle(el);
        const lineHeight = parseFloat(styles.lineHeight) || 16;
        const vertPadding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
        // Tailwind sets border-box, so scrollHeight covers padding but not border.
        const borders = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);

        const content = el.scrollHeight + borders;
        const ceiling = lineHeight * maxRows + vertPadding + borders;
        const floor = lineHeight * minRows + vertPadding + borders;

        el.style.height = `${Math.min(Math.max(content, floor), ceiling)}px`;
        el.style.overflowY = content > ceiling ? 'auto' : 'hidden';
    }, [maxRows, minRows]);

    useLayoutEffect(resize, [value, resize]);

    // A narrower column rewraps the text, which changes the height it needs.
    useEffect(() => {
        const el = innerRef.current;
        if (!el || typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', resize);
            return () => window.removeEventListener('resize', resize);
        }
        const observer = new ResizeObserver(resize);
        observer.observe(el);
        return () => observer.disconnect();
    }, [resize]);

    return (
        <textarea
            ref={setRefs}
            value={value}
            rows={minRows}
            className={`${className} resize-none`}
            {...rest}
        />
    );
});

export default AutoGrowTextarea;
