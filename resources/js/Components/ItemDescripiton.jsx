import {useState, useRef, useLayoutEffect} from 'react';

export default function     ItemDescription({text, lines = 2}) {
    const [expanded, setExpanded] = useState(false);
    const [clamped, setClamped] = useState(false);
    const ref = useRef(null);

    // Only offer the toggle when the text actually overflows — a one-line
    // description with a "Show more" link under it is just noise.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const check = () => setClamped(el.scrollHeight > el.clientHeight + 1);

        check();
        const observer = new ResizeObserver(check);
        observer.observe(el);
        return () => observer.disconnect();
    }, [text]);

    if (!text) return null;

    return (<div className="mt-0.5">

        <div ref={ref}
             className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {text}
        </div>

        {(clamped || expanded) && (<button
            type="button"
            onClick={() => setExpanded(open => !open)}
            aria-expanded={expanded}
            className="mt-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
        >
            {expanded ? 'Show less' : 'Show more'}
        </button>)}
    </div>);
}
