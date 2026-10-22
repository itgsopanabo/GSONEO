import { useEffect, useId, useState } from 'react'

/**
 * Collapsible sidebar section.
 *
 * <NavDropdown label="Utils" defaultOpen={route().current('items.*')}>
 *     <NavLink ...>Items</NavLink>
 * </NavDropdown>
 */
export default function NavDropdown({ label, defaultOpen = false, children }) {
    const [open, setOpen] = useState(defaultOpen)
    const panelId = useId()

    // Reopen if navigation lands on a route inside this section.
    useEffect(() => {
        if (defaultOpen) setOpen(true)
    }, [defaultOpen])

    return (
        <div className="flex flex-col">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls={panelId}
                className="flex w-full items-center justify-between rounded px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
            >
                <span >{label}</span>

                <svg
                    className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                        open ? 'rotate-90' : ''
                    }`}
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                >
                    <path d="M7 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {open && (
                <div
                    id={panelId}
                    className="mt-1 flex flex-col space-y-1 border-l border-gray-200 pl-3 dark:border-gray-700"
                >
                    {children}
                </div>
            )}
        </div>
    )
}
