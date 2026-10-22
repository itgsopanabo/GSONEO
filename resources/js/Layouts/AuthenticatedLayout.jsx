import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { Menu } from 'lucide-react';
import { ToastProvider } from '@/Contexts/ToastContext.jsx';
import RequiredPasswordChangeModal from '@/Components/RequiredPasswordChangeModal.jsx';
import Sidebar from '@/Components/Sidebar/Sidebar.jsx';

const COLLAPSED_KEY = 'sidebar:collapsed';

function readCollapsed() {
    try {
        return window.localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
        return false;
    }
}

export default function AuthenticatedLayout({ header, children }) {
    const [collapsed, setCollapsed] = useState(readCollapsed);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const toggleCollapsed = () =>
        setCollapsed((value) => {
            try {
                window.localStorage.setItem(COLLAPSED_KEY, value ? '0' : '1');
            } catch {
                // Private windows may block storage; the toggle still works for this visit.
            }
            return !value;
        });

    // Close the mobile drawer whenever a visit starts, and on Escape.
    useEffect(() => router.on('start', () => setDrawerOpen(false)), []);
    useEffect(() => {
        if (!drawerOpen) return;
        const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [drawerOpen]);

    return (
        <ToastProvider>
            <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
                {/* Desktop sidebar */}
                <aside className="hidden shrink-0 lg:block">
                    <div className="h-full transition-[width] duration-200">
                        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
                    </div>
                </aside>

                {/* Mobile drawer */}
                {drawerOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
                        <div className="absolute inset-0 bg-gray-900/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
                        <div className="relative h-full w-64 shadow-2xl">
                            <Sidebar mobile onClose={() => setDrawerOpen(false)} />
                        </div>
                    </div>
                )}

                {/* Main area */}
                <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
                    {/* Mobile top bar */}
                    <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800 lg:hidden">
                        <button
                            type="button"
                            onClick={() => setDrawerOpen(true)}
                            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                            aria-label="Open menu"
                            aria-expanded={drawerOpen}
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <img src="/icon.png" alt="" className="h-7 w-7 object-contain" />
                        <span className="text-sm font-semibold tracking-wide text-gray-900 dark:text-white">GSONEO</span>
                    </div>

                    {header && (
                        <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                            <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{header}</div>
                        </header>
                    )}

                    <main className="flex-1">{children}</main>
                </div>
            </div>

            <RequiredPasswordChangeModal />
        </ToastProvider>
    );
}
