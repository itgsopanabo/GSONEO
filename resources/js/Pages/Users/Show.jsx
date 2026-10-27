import { useEffect, useMemo, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, History, KeyRound, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate, formatDateTime } from '@/Utils/formatDate.js';
import DangerButton from '@/Components/DangerButton';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import SetPasswordModal from '@/Components/Users/SetPasswordModal';
import TemporaryPasswordModal from '@/Components/Users/TemporaryPasswordModal';
import { StatusBadge, initialsOf, lastSeen } from '@/Components/Users/UserBits.jsx';

function Card({ icon: Icon, title, description, children, tone = 'default' }) {
    const danger = tone === 'danger';
    return (
        <section className={`rounded-xl border bg-white shadow-sm dark:bg-gray-800 ${danger ? 'border-rose-200 dark:border-rose-500/30' : 'border-gray-100 dark:border-gray-700/60'}`}>
            <div className="px-5 py-4">
                <h3 className={`flex items-center gap-2 text-sm font-semibold ${danger ? 'text-rose-700 dark:text-rose-400' : 'text-gray-900 dark:text-gray-100'}`}>
                    {Icon && <Icon className="h-4 w-4" />}
                    {title}
                </h3>
                {description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
                {children && <div className="mt-4">{children}</div>}
            </div>
        </section>
    );
}

/** Actions are logged in several styles — "verified", "Generate RIS Number", "role_changed". */
function actionLabel(action) {
    const words = String(action ?? '').replace(/_/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

export default function Show({ user, statuses, roles = [], isSelf, recent = [], changeCount = 0 }) {
    const { auth } = usePage().props;
    const canSeeAudit = (auth?.permissions ?? []).includes('audit.view');

    const assignable = statuses.filter((s) => s.selectable !== false);
    const locked = !assignable.some((s) => s.id === user.status_id);

    const [confirming, setConfirming] = useState(false);
    const [changing, setChanging] = useState(false);
    const [settingPassword, setSettingPassword] = useState(false);
    const [selectedRole, setSelectedRole] = useState(user.role_id);
    const [confirmingRole, setConfirmingRole] = useState(false);
    const [savingRole, setSavingRole] = useState(false);

    // Follow the saved role after a change goes through.
    useEffect(() => setSelectedRole(user.role_id), [user.role_id]);

    const rolesBySection = useMemo(
        () =>
            roles.reduce((groups, role) => {
                (groups[role.section] ??= []).push(role);
                return groups;
            }, {}),
        [roles],
    );
    const roleChanged = selectedRole !== user.role_id;
    const newRole = roles.find((role) => role.id === selectedRole);

    const saveRole = () => {
        setSavingRole(true);
        router.patch(
            route('users.role', user.id),
            { role_id: selectedRole },
            {
                preserveScroll: true,
                onSuccess: () => setConfirmingRole(false),
                onFinish: () => setSavingRole(false),
            },
        );
    };

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

    const fullName = `${user.emp_lname}, ${user.emp_fname}`;

    return (
        <AuthenticatedLayout>
            <Head title={fullName} />

            <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                <Link
                    href={route('users.index')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    User List
                </Link>

                {/* Who */}
                <section className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
                    <div className="flex flex-col gap-5 px-6 py-5 sm:flex-row sm:items-center">
                        <span
                            aria-hidden="true"
                            className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold ${user.is_active
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}
                        >
                            {initialsOf(user.emp_fname, user.emp_lname)}
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{fullName}</h1>
                                <StatusBadge code={user.status_code} label={user.status} />
                                {isSelf && (
                                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">You</span>
                                )}
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                <span className="font-mono">Employee {user.emp_id}</span>
                                {' · '}
                                {user.role ?? 'No role'}{user.section ? ` · ${user.section}` : ''}
                            </p>
                        </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-4 border-t border-gray-100 px-6 py-4 sm:grid-cols-4 dark:border-gray-700/60">
                        {[
                            ['Last active', lastSeen(user.last_active) ?? 'Never', user.last_active ? formatDateTime(user.last_active) : undefined],
                            ['Changes made', Number(changeCount).toLocaleString()],
                            ['Account created', formatDate(user.created_at)],
                            ['Last updated', user.updated_at ?? '—'],
                        ].map(([label, value, title]) => (
                            <div key={label}>
                                <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</dt>
                                <dd className="mt-1 text-xs font-medium text-gray-900 dark:text-white" title={title}>{value}</dd>
                            </div>
                        ))}
                    </dl>
                </section>

                <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                    <div className="space-y-5">
                        <Card
                            icon={UserCog}
                            title="Role"
                            description={isSelf
                                ? 'Change your own role from another admin account, so you cannot lock yourself out.'
                                : 'The role decides which menus, pages and dashboard this person sees, from their next page load.'}
                        >
                            <div className="flex flex-wrap items-center gap-3">
                                <label htmlFor="user-role" className="sr-only">Role</label>
                                <select
                                    id="user-role"
                                    value={selectedRole}
                                    disabled={isSelf || savingRole}
                                    onChange={(e) => setSelectedRole(Number(e.target.value))}
                                    className="min-w-[16rem] flex-1 rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                                >
                                    {Object.entries(rolesBySection).map(([section, sectionRoles]) => (
                                        <optgroup key={section} label={section}>
                                            {sectionRoles.map((role) => (
                                                <option key={role.id} value={role.id}>{role.role_name}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                                {roleChanged && (
                                    <>
                                        <PrimaryButton onClick={() => setConfirmingRole(true)} disabled={savingRole}>Save role</PrimaryButton>
                                        <button type="button" onClick={() => setSelectedRole(user.role_id)} className="text-xs text-gray-500 hover:underline dark:text-gray-400">
                                            Undo
                                        </button>
                                    </>
                                )}
                            </div>
                        </Card>

                        <Card
                            icon={ShieldCheck}
                            title="Account access"
                            description={isSelf
                                ? 'You cannot change the status of the account you are signed in with.'
                                : locked
                                    ? 'This account holds a status that user management does not assign. Change it from the system that set it.'
                                    : 'Inactive and locked accounts are refused at sign-in. Anyone already signed in keeps working until their session ends.'}
                        >
                            <div role="radiogroup" aria-label="Account status" className="inline-flex flex-wrap rounded-lg border border-gray-200 p-0.5 text-xs dark:border-gray-700">
                                {assignable.map((status) => {
                                    const current = status.id === user.status_id;
                                    return (
                                        <button
                                            key={status.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={current}
                                            disabled={isSelf || locked || changing}
                                            onClick={() => changeStatus(status.id)}
                                            className={`rounded-md px-3 py-1.5 font-medium disabled:cursor-not-allowed ${current
                                                ? 'bg-indigo-600 text-white'
                                                : 'text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-900/40'}`}
                                        >
                                            {status.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>

                        <Card
                            icon={KeyRound}
                            title="Password"
                            description={isSelf
                                ? 'Change your own password from your profile page, where you confirm your current one.'
                                : 'Passwords are stored in a form that cannot be read back. You can replace this one with a one-time password, which they change at sign-in.'}
                        >
                            {isSelf ? (
                                <Link href={route('profile.edit')}>
                                    <SecondaryButton>Go to your profile</SecondaryButton>
                                </Link>
                            ) : (
                                <SecondaryButton onClick={() => setSettingPassword(true)}>Issue one-time password</SecondaryButton>
                            )}
                        </Card>
                    </div>

                    <div className="space-y-5">
                        {/* What this person has been doing */}
                        <section className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
                            <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-700/60">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    <History className="h-4 w-4" />
                                    Recent activity
                                </h3>
                                {canSeeAudit && changeCount > 0 && (
                                    <Link
                                        href={route('audit-logs.index', { user: user.emp_id })}
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                                    >
                                        All {changeCount}
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                )}
                            </header>
                            {recent.length === 0 ? (
                                <p className="px-5 py-8 text-center text-xs text-gray-500 dark:text-gray-400">No changes recorded yet.</p>
                            ) : (
                                <ol className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                    {recent.map((entry) => (
                                        <li key={entry.id} className="px-5 py-3">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{actionLabel(entry.action)}</p>
                                                <time dateTime={entry.created_at} title={formatDateTime(entry.created_at)} className="shrink-0 text-[11px] text-gray-400">
                                                    {lastSeen(entry.created_at)}
                                                </time>
                                            </div>
                                            {entry.description && (
                                                <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">{entry.description}</p>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </section>

                        {!isSelf && (
                            <Card
                                icon={Trash2}
                                tone="danger"
                                title="Delete this account"
                                description="Permanent. If they have filed requests or records, mark them inactive instead so their history stays intact."
                            >
                                <DangerButton onClick={() => setConfirming(true)}>Delete user</DangerButton>
                            </Card>
                        )}
                    </div>
                </div>
            </div>

            <SetPasswordModal
                user={settingPassword ? { id: user.id, emp_id: user.emp_id, name: fullName } : null}
                onClose={() => setSettingPassword(false)}
            />

            <TemporaryPasswordModal />

            <Modal show={confirmingRole} onClose={() => !savingRole && setConfirmingRole(false)} maxWidth="md">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Change the role of {fullName}?</h2>
                    <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                        <dt className="text-gray-500 dark:text-gray-400">From</dt>
                        <dd className="text-gray-800 dark:text-gray-200">
                            {user.role} <span className="text-gray-400">({user.section})</span>
                        </dd>
                        <dt className="text-gray-500 dark:text-gray-400">To</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">
                            {newRole?.role_name} <span className="font-normal text-gray-400">({newRole?.section})</span>
                        </dd>
                    </dl>
                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                        They lose access to anything the old role allowed and gain what the new role allows as soon as
                        they load another page.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={() => setConfirmingRole(false)} disabled={savingRole}>Cancel</SecondaryButton>
                        <PrimaryButton onClick={saveRole} disabled={savingRole}>{savingRole ? 'Saving…' : 'Change role'}</PrimaryButton>
                    </div>
                </div>
            </Modal>

            <Modal show={confirming} onClose={() => setConfirming(false)} maxWidth="md">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete {fullName}?</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        This permanently removes employee {user.emp_id}. If they have submitted requests or records,
                        mark them inactive instead so the history stays intact.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={() => setConfirming(false)}>Cancel</SecondaryButton>
                        <DangerButton onClick={deleteUser}>Delete user</DangerButton>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
