    import {Head, Link, router, usePage} from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {STATUS_MAP} from '@/constants/statusConfig';
import {useEffect} from "react";


export default function Index({purchaseRequests}) {
    const requests = purchaseRequests?.data || [];

    // Cleanly extract flash and auth from global page props
    const {flash, auth} = usePage().props;
    const userSection = auth?.user?.role?.section;

    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({
                only: ['purchaseRequests'], // Only fetch the necessary prop
                preserveScroll: true,       // Keep the user's scroll position
                preserveState: true         // Maintain local component state
            });
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(interval);
    }, []);

    return (<AuthenticatedLayout>
        <Head title="Procurement Section - Purchase Request Management"/>

        <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                        Purchase Requests
                    </h1>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Manage, monitor, and process procurement tracks.
                    </p>
                </div>

                {userSection === 'Administration' && (<div>
                    <Link
                        href={route('purchase-requests.create')}
                        className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold tracking-wide text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 active:bg-indigo-700 transition duration-150 ease-in-out shadow-sm"
                    >
                        Create Request
                    </Link>
                </div>)}
            </div>

            {/* Table Container */}
            <div
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700/60">
                            <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">PR
                                Number
                            </th>
                            <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Requested
                                By
                            </th>
                            <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Department</th>
                            <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                        {requests.length > 0 ? (requests.map((pr) => (<tr key={pr.id}
                                                                          className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                                {pr.pr_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
                                {pr.requester_name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
                                {pr.requester_department}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_MAP[pr.status]?.style || 'bg-gray-50 border-gray-200'}`}>
                                    {/* Visual indicator dot */}
                                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                    {STATUS_MAP[pr.status]?.label || 'Unknown'}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
                                <Link
                                    href={route('purchase-requests.show', pr.id)}
                                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 transition-colors"
                                >
                                    View Details
                                </Link>
                            </td>
                        </tr>))) : (<tr>
                            <td colSpan="5" className="px-6 py-16 text-center">
                                <div className="flex flex-col items-center justify-center space-y-2">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">No requests
                                        found</p>
                                    <p className="text-xs text-gray-500">Get started by creating your first purchase
                                        request.</p>
                                    {userSection === 'Administration' && (<Link href={route('purchase-requests.create')}
                                                                                className="mt-2 text-xs text-indigo-600 font-semibold hover:underline">
                                            Create New Request →
                                        </Link>)}
                                </div>
                            </td>
                        </tr>)}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {purchaseRequests?.links && purchaseRequests.links.length > 3 && (<div
                    className="px-6 py-4 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                    <div className="flex gap-1 ml-auto">
                        {purchaseRequests.links.map((link, index) => (<Link
                            key={index}
                            href={link.url || '#'}
                            dangerouslySetInnerHTML={{__html: link.label}}
                            className={`px-3 py-1 text-xs rounded-md border transition-all ${link.active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'} ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />))}
                    </div>
                </div>)}
            </div>
        </div>
    </AuthenticatedLayout>);
}
