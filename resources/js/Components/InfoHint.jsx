import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'

/**
 * The ⓘ beside a card's title: what this card is counting, and where the number
 * comes from.
 *
 * Opens on hover and on keyboard focus, and stays open on click — a tooltip that
 * only answers to hover is unreachable by keyboard and unusable on a touch
 * screen, which is half the people reading a dashboard on a phone.
 *
 * Positioned `fixed` off the button's own rectangle for the same reason as the
 * row menu: cards and tables sit inside containers that clip their overflow.
 */
export default function InfoHint({ text, label = 'What this shows' }) {
    const [open, setOpen] = useState(false)
    const [pinned, setPinned] = useState(false)
    const [position, setPosition] = useState(null)
    const buttonRef = useRef(null)
    const bubbleRef = useRef(null)
    const id = useId()

    useLayoutEffect(() => {
        if (!open || !buttonRef.current) return

        const rect = buttonRef.current.getBoundingClientRect()
        const bubble = bubbleRef.current
        const width = bubble?.offsetWidth ?? 260
        const height = bubble?.offsetHeight ?? 80

        // Kept inside the viewport on both axes: these sit near the right edge of
        // half-width cards, and near the bottom on the last row.
        const left = Math.min(Math.max(rect.left - 8, 8), window.innerWidth - width - 8)
        const below = window.innerHeight - rect.bottom

        setPosition({
            left,
            ...(below < height + 12 ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
        })
    }, [open, text])

    useEffect(() => {
        if (!open) return

        const close = () => {
            setOpen(false)
            setPinned(false)
        }
        const onKey = (e) => {
            if (e.key === 'Escape') {
                close()
                buttonRef.current?.focus()
            }
        }
        const onClick = (e) => {
            if (!bubbleRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) close()
        }

        document.addEventListener('keydown', onKey)
        document.addEventListener('mousedown', onClick)
        window.addEventListener('scroll', close, true)
        window.addEventListener('resize', close)

        return () => {
            document.removeEventListener('keydown', onKey)
            document.removeEventListener('mousedown', onClick)
            window.removeEventListener('scroll', close, true)
            window.removeEventListener('resize', close)
        }
    }, [open])

    if (!text) return null

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                aria-label={label}
                aria-describedby={open ? id : undefined}
                aria-expanded={open}
                onClick={(e) => {
                    // Cards are often wrapped in a link; the hint is not a way into it.
                    e.preventDefault()
                    e.stopPropagation()
                    setPinned((v) => !v)
                    setOpen((v) => !v || !pinned)
                }}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => !pinned && setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => !pinned && setOpen(false)}
                className="inline-flex shrink-0 rounded-full p-0.5 align-middle text-gray-400 transition-colors hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-500 dark:hover:text-gray-200"
            >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            {open && (
                <span
                    ref={bubbleRef}
                    id={id}
                    role="tooltip"
                    style={{ position: 'fixed', ...(position ?? { top: -9999, left: 0 }) }}
                    className="z-50 block max-w-xs rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal leading-relaxed text-gray-100 shadow-lg dark:bg-gray-700"
                >
                    {text}
                </span>
            )}
        </>
    )
}
