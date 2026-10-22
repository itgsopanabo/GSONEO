import { Link } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import InfoHint from '@/Components/InfoHint.jsx';

/**
 * Shared frame for dashboard widgets: title, optional subtitle and "View all" link.
 *
 * `info` adds the ⓘ beside the title — what the card counts and where it comes
 * from. The text lives with the widget in Registry.jsx, so every card is
 * explained in one place rather than in whichever component happens to render it.
 */
export default function DashboardCard({ title, subtitle, href, hrefLabel = 'View all', aside, info, icon: Icon, children }) {
    return (
        <section className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-700/60">
                <div className="flex min-w-0 items-start gap-3">
                    {Icon && (
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                            <Icon className="h-4 w-4" />
                        </span>
                    )}
                    <div className="min-w-0">
                        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                            <span className="min-w-0 truncate">{title}</span>
                            <InfoHint text={info} label={`What "${title}" shows`} />
                        </h3>
                        {subtitle && (
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {aside}
                    {href && (
                        <Link
                            href={href}
                            className="inline-flex items-center gap-1 rounded-md text-xs font-semibold text-indigo-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-400"
                        >
                            {hrefLabel}
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    )}
                </div>
            </header>
            <div className="flex-1">{children}</div>
        </section>
    );
}
