import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'

/**
 * The kebab menu on a table row.
 *
 * Positioned with `fixed` off the button's own rectangle rather than absolutely
 * inside the row: the table scrolls horizontally, and a scroll container clips
 * on both axes, so an absolutely positioned menu would be cut off on the last
 * rows and at the right-hand edge.
 *
 * Items are `{ label, onSelect, danger, disabled, hint }`. A disabled item stays
 * on the menu with its `hint` as the reason — why an action is unavailable is
 * usually what the person wants to know.
 */
export default function RowActionsMenu({ items = [], label = 'Row actions' }) {
    const [open, setOpen] = useState(false)
    const [position, setPosition] = useState(null)
    const buttonRef = useRef(null)
    const menuRef = useRef(null)

    // Placed after layout so the menu never paints in the wrong spot first.
    useLayoutEffect(() => {
        if (!open || !buttonRef.current) return

        const rect = buttonRef.current.getBoundingClientRect()
        const height = menuRef.current?.offsetHeight ?? items.length * 40 + 16
        const below = window.innerHeight - rect.bottom

        setPosition({
            right: Math.max(window.innerWidth - rect.right, 8),
            // Flip above the button when there isn't room under it.
            ...(below < height + 16 ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
        })
    }, [open, items.length])

    useEffect(() => {
        if (!open) return

        const close = () => setOpen(false)
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setOpen(false)
                buttonRef.current?.focus()
            }
        }
        const onClick = (e) => {
            if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) close()
        }

        document.addEventListener('keydown', onKey)
        document.addEventListener('mousedown', onClick)
        // The row can scroll out from under an open menu, so it closes rather
        // than trailing behind the button it belongs to.
        window.addEventListener('scroll', close, true)
        window.addEventListener('resize', close)

        return () => {
            document.removeEventListener('keydown', onKey)
            document.removeEventListener('mousedown', onClick)
            window.removeEventListener('scroll', close, true)
            window.removeEventListener('resize', close)
        }
    }, [open])

    if (items.length === 0) return null

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className={`rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100 ${
                    open ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100' : ''
                }`}
            >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </button>

            {open && (
                <div
                    ref={menuRef}
                    role="menu"
                    style={{ position: 'fixed', ...(position ?? { top: -9999, right: 0 }) }}
                    className="z-50 min-w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-left shadow-lg dark:border-gray-700 dark:bg-gray-800"
                >
                    {items.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled}
                            title={item.hint ?? undefined}
                            onClick={() => {
                                setOpen(false)
                                item.onSelect?.()
                            }}
                            className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                                item.disabled
                                    ? 'cursor-not-allowed text-gray-400 dark:text-gray-600'
                                    : item.danger
                                      ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
                                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {item.label}
                            {item.disabled && item.hint && (
                                <span className="mt-0.5 block text-xs text-gray-400 dark:text-gray-600">{item.hint}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </>
    )
}
