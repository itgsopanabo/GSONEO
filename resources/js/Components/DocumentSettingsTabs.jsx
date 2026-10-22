import { Link } from '@inertiajs/react';

const TABS = [
    { label: 'Letterhead and design', route: 'document-settings.index' },
    { label: 'Signatories', route: 'document-settings.signatories' },
];

/** Switches between the two Document Branding screens. */
export default function DocumentSettingsTabs() {
    return (
        <nav aria-label="Document branding" className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
            {TABS.map((tab) => {
                const active = route().current(tab.route);
                return (
                    <Link
                        key={tab.route}
                        href={route(tab.route)}
                        aria-current={active ? 'page' : undefined}
                        className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                            active
                                ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
