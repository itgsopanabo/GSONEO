import { SPAN_CLASSES, WIDGET_REGISTRY } from '@/Components/DasboardComponents/registry';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';

/**
 * `widgets`    ordered widget keys the backend decided this user may see
 * `widgetData` keyed by the same widget key; a widget only gets its own slice
 */
export default function Dashboard({ widgets = [], widgetData = {} }) {
    const { auth } = usePage().props;

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="py-10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    {widgets.length === 0 ? (
                        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                            No dashboard has been set up for your role yet. Ask your system
                            administrator to assign one.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                            {widgets.map((key) => {
                                const entry = WIDGET_REGISTRY[key];

                                if (!entry) {
                                    if (import.meta.env.DEV) {
                                        console.warn(
                                            `Dashboard: no component registered for widget "${key}".`,
                                        );
                                    }
                                    return null;
                                }

                                const Widget = entry.component;

                                return (
                                    <div
                                        key={key}
                                        className={`col-span-1 ${SPAN_CLASSES[entry.span] ?? SPAN_CLASSES.full}`}
                                    >
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
