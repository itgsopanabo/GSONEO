import { useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DangerButton from '@/Components/DangerButton';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import Pagination from '@/Components/Pagination';

const selectClasses =
    'rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';

export default function Index({ auth, users, filters, roles, statuses }) {
    const [search, setSearch] = useState(filters.search || '');
    const [role, setRole] = useState(filters.role || '');
    const [status, setStatus] = useState(filters.status || '');
    const [confirming, setConfirming] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timeout = setTimeout(() => {
            router.get(
                route('users.index'),
                {
                    search: search || undefined,
                    role: role || undefined,
                    status: status || undefined,
                },
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 300);

        return () => clearTimeout(timeout);
    }, [search, role, status]);

    const changeStatus = (user, statusId) => {
        if (Number(statusId) === user.status_id) return;

        setBusyId(user.id);
        router.patch(
            route('users.status', user.id),
            { status_id: statusId },
            { preserveScroll: true, onFinish: () => setBusyId(null) },
        );
    };

    const deleteUser = () => {
        router.delete(route('users.destroy', confirming.id), {
            preserveScroll: true,
            onFinish: () => setConfirming(null),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    User List
                </h2>
            }
        >
            <Head title="User List" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden bg-white shadow-sm dark:bg-gray-800 sm:rounded-lg">
                        <div className="flex flex-col gap-3 border-b border-gray-100 p-6 dark:border-gray-700 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <TextInput
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search name or employee ID"
                                    className="w-full text-sm sm:w-64"
                                />

                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className={`${selectClasses} text-sm`}
                                >
                                    <option value="">All roles</option>
                                    {roles.map((r) => (
                                        <option key={r.id} value={r.id}>
                                            {r.label}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className={`${selectClasses} text-sm`}
                                >
                                    <option value="">All statuses</option>
                                    {statuses.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <Link href={route('users.create')}>
                                <PrimaryButton>Add user</PrimaryButton>
                            </Link>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
                                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-400 dark:bg-gray-900 dark:text-gray-500">
                                <tr>
                                    <th className="px-6 py-3 font-semibold">Emp ID</th>
                                    <th className="px-6 py-3 font-semibold">Name</th>
                                    <th className="px-6 py-3 font-semibold">Role</th>
                                    <th className="px-6 py-3 font-semibold">Status</th>
                                    <th className="px-6 py-3" />
                                </tr>
                                </thead>
                                <tbody>
                                {users.data.map((user) => {
                                    const isSelf = user.id === auth.user.id;
                                    const canSetStatus = statuses.some(
                                        (s) => s.id === user.status_id,
                                    );

                                    return (
                                        <tr
                                            key={user.id}
                                            className="border-t border-gray-100 dark:border-gray-700"
                                        >
                                            <td className="px-6 py-4 font-mono text-xs">
                                                {user.emp_id}
                                            </td>
                                            <td className="px-6 py-4">
                                                <Link
                                                    href={route('users.show', user.id)}
                                                    className="font-medium text-gray-800 hover:text-indigo-600 hover:underline dark:text-gray-200 dark:hover:text-indigo-400"
                                                >
                                                    {user.name}
                                                </Link>
                                                {isSelf && (
                                                    <span className="ml-2 text-xs text-gray-400">
                                                            you
                                                        </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.role}
                                                <span className="block text-xs text-gray-400 dark:text-gray-500">
                                                        {user.section}
                                                    </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {!canSetStatus ? (
                                                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                                            {user.status}
                                                        </span>
                                                ) : (
                                                    <select
                                                        value={user.status_id}
                                                        disabled={isSelf || busyId === user.id}
                                                        onChange={(e) =>
                                                            changeStatus(user, e.target.value)
                                                        }
                                                        className={`rounded-full border-0 py-1 pl-3 pr-8 text-xs font-medium focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 ${
                                                            user.is_active
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                                        }`}
                                                    >
                                                        {statuses.map((s) => (
                                                            <option key={s.id} value={s.id}>
                                                                {s.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right">
                                                <Link
                                                    href={route('users.edit', user.id)}
                                                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                                                >
                                                    Edit
                                                </Link>
                                                {!isSelf && (
                                                    <button
                                                        onClick={() => setConfirming(user)}
                                                        className="ml-4 text-red-600 hover:underline dark:text-red-400"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {users.data.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-6 py-12 text-center text-gray-500"
                                        >
                                            No users match this search. Try a different
                                            name, employee ID, role, or status.
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>

                        <div className="border-t border-gray-100 p-6 dark:border-gray-700">
                            <Pagination links={users.links} />
                        </div>
                    </div>
                </div>
            </div>

            <Modal show={confirming !== null} onClose={() => setConfirming(null)} maxWidth="md">
                <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        Delete {confirming?.name}?
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        This permanently removes employee {confirming?.emp_id}. If they have
                        submitted requests or records, set them to inactive instead so the
                        history stays intact.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={() => setConfirming(null)}>
                            Cancel
                        </SecondaryButton>
                        <DangerButton onClick={deleteUser}>Delete user</DangerButton>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
