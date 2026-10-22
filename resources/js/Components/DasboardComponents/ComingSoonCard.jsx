/** Shown to sections whose module hasn't been built yet, so the page isn't just a clock. */
export default function ComingSoonCard({ auth }) {
    const section = auth?.user?.role?.section ?? 'your section';

    return (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-600 dark:bg-gray-800">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                The {section} module is on its way
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
                Your work queues and counters will appear here once the module is available. Until then, you can
                still file a leave application from the menu.
            </p>
        </div>
    );
}
