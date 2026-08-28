import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { UNIT_GROUPS, DEFAULT_UNIT } from '../../Constants/Units.jsx';

/**
 * Unit field for the paste grid: a text input with a grouped dropdown.
 *
 * It can't be a <select>. A select won't accept a pasted column, and pasting
 * a whole unit column out of Excel is the reason the grid exists. So the cell
 * stays a text input — paste, OCR output and unfamiliar units all still work —
 * and the dropdown is an assist on top of it.
 *
 * The list renders fixed-positioned rather than absolute, because the grid sits
 * inside an overflow container that would otherwise clip it.
 */
const UnitCell = forwardRef(function UnitCell(
    { value, onChange, onPaste, onKeyDown, className = '' },
    ref,
) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [rect, setRect] = useState(null);
    const wrapRef = useRef(null);
    const listRef = useRef(null);

    const query = String(value ?? '').trim().toLowerCase();

    // Typing filters the list; an exact match shows everything again so the
    // encoder can still see the neighbouring units in that group.
    const exact = UNIT_GROUPS.some(g => g.units.includes(query));
    const groups = (query === '' || exact)
        ? UNIT_GROUPS
        : UNIT_GROUPS
            .map(g => ({ ...g, units: g.units.filter(u => u.includes(query)) }))
            .filter(g => g.units.length > 0);

    const flat = groups.flatMap(g => g.units);

    const measure = () => {
        const el = wrapRef.current;
        if (el) setRect(el.getBoundingClientRect());
    };

    useLayoutEffect(() => {
        if (open) measure();
    }, [open, flat.length]);

    useEffect(() => {
        if (!open) return;

        const close = () => setOpen(false);
        const onDocDown = e => {
            if (wrapRef.current?.contains(e.target)) return;
            if (listRef.current?.contains(e.target)) return;
            setOpen(false);
        };

        document.addEventListener('mousedown', onDocDown);
        window.addEventListener('resize', close);
        // Capture phase catches scrolling of the grid's own overflow container.
        window.addEventListener('scroll', close, true);
        return () => {
            document.removeEventListener('mousedown', onDocDown);
            window.removeEventListener('resize', close);
            window.removeEventListener('scroll', close, true);
        };
    }, [open]);

    useEffect(() => {
        if (active >= flat.length) setActive(0);
    }, [flat.length, active]);

    const pick = unit => {
        onChange(unit);
        setOpen(false);
        wrapRef.current?.querySelector('input')?.focus();
    };

    const handleKeyDown = e => {
        if (!open) {
            // Alt+Down opens the list. Plain arrows stay with the grid so
            // moving between rows keeps working the way it does everywhere else.
            if (e.key === 'ArrowDown' && e.altKey) {
                e.preventDefault();
                setOpen(true);
                return;
            }
            onKeyDown?.(e);
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive(i => Math.min(i + 1, flat.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (flat[active]) pick(flat[active]);
            else setOpen(false);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
        } else if (e.key === 'Tab') {
            setOpen(false);
        }
    };

    return (
        <div ref={wrapRef} className="relative flex items-center">
            <input
                ref={ref}
                type="text"
                value={value}
                spellCheck={false}
                role="combobox"
                aria-expanded={open}
                aria-autocomplete="list"
                placeholder={DEFAULT_UNIT}
                onChange={e => {
                    onChange(e.target.value);
                    setOpen(true);
                    setActive(0);
                }}
                onPaste={e => {
                    setOpen(false);
                    onPaste?.(e);
                }}
                onKeyDown={handleKeyDown}
                className={`${className} pr-5`}
            />

            <button
                type="button"
                tabIndex={-1}
                aria-label="Show units"
                onMouseDown={e => e.preventDefault()} // keep focus in the input
                onClick={() => setOpen(o => !o)}
                className="absolute right-0.5 p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </button>

            {open && rect && (
                <div
                    ref={listRef}
                    role="listbox"
                    style={{
                        position: 'fixed',
                        top: Math.min(rect.bottom + 2, window.innerHeight - 240),
                        left: rect.left,
                        width: Math.max(rect.width, 140),
                        maxHeight: 232,
                        zIndex: 60,
                    }}
                    className="overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
                >
                    {flat.length === 0 ? (
                        <p className="px-2 py-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                            No match. Keep typing to use it as written.
                        </p>
                    ) : (
                        groups.map(group => (
                            <div key={group.label}>
                                <p className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    {group.label}
                                </p>
                                {group.units.map(unit => {
                                    const index = flat.indexOf(unit);
                                    const isActive = index === active;
                                    return (
                                        <button
                                            key={`${group.label}-${unit}`}
                                            type="button"
                                            role="option"
                                            aria-selected={isActive}
                                            onMouseEnter={() => setActive(index)}
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => pick(unit)}
                                            className={`w-full text-left px-2 py-1 text-xs ${
                                                isActive
                                                    ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                                                    : 'text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            {unit}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
});

export default UnitCell;
