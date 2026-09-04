import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DangerButton from '@/Components/DangerButton';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

function Field({ label, children }) {
    return (
        <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="mt-1 text-sm text-gray-800 dark:text-gray-200 sm:col-span-2 sm:mt-0">
                {children}
            </dd>
        </div>
    );
}

export default function Show({ user, statuses, isSelf }) {
    const assignable = statuses.filter((s) => s.selectable !== false);
    const locked = !assignable.some((s) => s.id === user.status_id);

    const [confirming, setConfirming] = useState(false);
    const [changing, setChanging] = useState(false);

    const changeStatus = (statusId) => {
        if (Number(statusId) === user.status_id) return;

        setChanging(true);
        router.patch(
            route('users.status', user.id),
            { status_id: statusId },
            { preserveScroll: true, onFinish: () => setChanging(false) },
        );
    };

    const deleteUser = () => {
        router.delete(route('users.destroy', user.id), {
            onFinish: () => setConfirming(false),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                        {user.emp_lname}, {user.emp_fname}
                    </h2>
                    <Link
                        href={route('users.index')}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        Back to list
                    </Link>
                </div>
            }
        >
            <Head title={`${user.emp_lname}, ${user.emp_fname}`} />

            <div className="py-12">
                <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="bg-white p-6 shadow-sm dark:bg-gray-800 sm:rounded-lg">
                        <dl className="divide-y divide-gray-100 dark:divide-gray-700">
                            <Field label="Employee ID">
                                <span className="font-mono">{user.emp_id}</span>
                            </Field>
                            <Field label="First name">{user.emp_fname}</Field>
                            <Field label="Last name">{user.emp_lname}</Field>
                            <Field label="Role">
                                {user.role}
                                <span className="block text-xs text-gray-400 dark:text-gray-500">
                                    {user.section}
                                </span>
                            </Field>
                            <Field label="Status">
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                        user.is_active
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                    }`}
                                >
                                    {user.status}
                                </span>
                            </Field>
                            <Field label="Account created">{user.created_at}</Field>
                            <Field label="Last updated">{user.updated_at}</Field>
                        </dl>
                    </div>

                    <div className="bg-white p-6 shadow-sm dark:bg-gray-800 sm:rounded-lg">
                        <h3 className="text-base font-medium text-gray-800 dark:text-gray-200">
                            Account access
                        </h3>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {isSelf
                                ? 'You cannot change the status of the account you are signed in with.'
                                : locked
                                    ? 'This account holds a status that user management does not assign. Change it from the system that set it.'
                                    : 'Inactive accounts are refused at sign-in. Anyone already signed in keeps working until their session ends.'}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <select
                                value={user.status_id}
                                disabled={isSelf || locked || changing}
                                onChange={(e) => changeStatus(e.target.value)}
                                className="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                            >
                                {statuses.map((status) => (
                                    <option key={status.id} value={status.id}>
                                        {status.label}
                                    </option>
                                ))}
                            </select>

                            <Link href={route('users.edit', user.id)}>
                                <PrimaryButton>Edit details</PrimaryButton>
                            </Link>

                            {!isSelf && (
                                <DangerButton
                                    onClick={() => setConfirming(true)}
                                    className="ml-auto"
                                >
                                    Delete user
                                </DangerButton>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Modal show={confirming} onClose={() => setConfirming(false)} maxWidth="md">
                <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        Delete {user.emp_lname}, {user.emp_fname}?
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        This permanently removes employee {user.emp_id}. If they have
                        submitted requests or records, set them to inactive instead so the
                        history stays intact.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={() => setConfirming(false)}>
                            Cancel
                        </SecondaryButton>
                        <DangerButton onClick={deleteUser}>Delete user</DangerButton>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
