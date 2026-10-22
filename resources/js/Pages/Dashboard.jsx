import { SPAN_CLASSES, WIDGET_REGISTRY } from '@/Components/DasboardComponents/Registry';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';

/**
 * Half-width widgets sit side by side in pairs. A half-width widget with no
 * partner next to it stretches to full width, so a role with one queue
 * doesn't get a blank column beside it.
 */
function layoutSpans(keys) {
    const spans = {};

    for (let i = 0; i < keys.length; i++) {
        const span = WIDGET_REGISTRY[keys[i]]?.span ?? 'full';

        if (span === 'half' && WIDGET_REGISTRY[keys[i + 1]]?.span === 'half') {
            spans[keys[i]] = 'half';
            spans[keys[i + 1]] = 'half';
            i++;
            continue;
        }

        spans[keys[i]] = span === 'half' ? 'full' : span;
    }

    return spans;
}

/**
 * `widgets`    ordered widget keys the backend decided this user may see
 * `widgetData` keyed by the same widget key; a widget only gets its own slice
 * `tabs`       Overview / Pipeline / Reports for holders of dashboard.analytics,
 *              empty for everyone else — the page is then the single scroll it
 *              has always been, which suits a screen of work queues
 */
export default function Dashboard({ widgets = [], widgetData = {}, tabs = [] }) {
    const { auth } = usePage().props;

    // The tab lives in the address (#pipeline) so a refresh or a shared link opens
    // the same view — the same trick the Docs page uses.
    const readTab = () => {
        const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
        return tabs.some((t) => t.key === hash) ? hash : tabs[0]?.key;
    };
    const [tab, setTab] = useState(readTab);

    const chooseTab = (key) => {
        setTab(key);
        window.history.replaceState(null, '', key === tabs[0]?.key ? window.location.pathname : `#${key}`);
    };

    const active = tabs.find((t) => t.key === tab) ?? tabs[0];
    const shown = tabs.length > 0 ? (active?.widgets ?? []) : widgets;

    const visible = shown.filter((key) => {
        if (WIDGET_REGISTRY[key]) return true;
        if (import.meta.env.DEV) {
            console.warn(`Dashboard: no component registered for widget "${key}".`);
        }
        return false;
    });
    const spans = layoutSpans(visible);

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="py-6">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    {tabs.length > 0 && (
                        <div
                            role="tablist"
                            aria-label="Dashboard views"
                            className="mb-5 inline-flex flex-wrap rounded-lg border border-gray-200 bg-white p-0.5 text-xs dark:border-gray-700 dark:bg-gray-800"
                        >
                            {tabs.map((t) => (
                                <button
                                    key={t.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={active?.key === t.key}
                                    onClick={() => chooseTab(t.key)}
                                    className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                                        active?.key === t.key
                                            ? 'bg-indigo-600 text-white'
                                            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900/40'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {visible.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            No dashboard has been set up for your role yet. Ask your system
                            administrator to assign one.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                            {visible.map((key) => {
                                const entry = WIDGET_REGISTRY[key];
                                const Widget = entry.component;

                                return (
                                    <div key={key} className={`col-span-1 min-w-0 ${SPAN_CLASSES[spans[key]] ?? SPAN_CLASSES.full}`}>
                                        <Widget
                                            data={widgetData[key]}
                                            auth={auth}
                                            {...(entry.props ?? {})}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
