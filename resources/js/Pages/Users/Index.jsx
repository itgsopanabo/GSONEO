import { useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Ban, Lock, Search, UserCheck, UserPlus, Users } from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DangerButton from '@/Components/DangerButton';
import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import RowActionsMenu from '@/Components/RowActionsMenu.jsx';
import SetPasswordModal from '@/Components/Users/SetPasswordModal';
import AddUserModal from '@/Components/Users/AddUserModal';
import TemporaryPasswordModal from '@/Components/Users/TemporaryPasswordModal';
import { StatusBadge, initialsOf, lastSeen } from '@/Components/Users/UserBits.jsx';
import { formatDateTime } from '@/Utils/formatDate.js';

/** Account status codes (config/Users.php). */
const ACTIVE = 900;
const INACTIVE = 901;
const LOCKED = 902;

const selectClass = 'rounded-lg border-gray-200 bg-gray-50 text-xs text-gray-700 shadow-sm focus:border-indigo-400 focus:ring-indigo-500/40 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200';

function Stat({ icon: Icon, label, value, hint, active, onClick }) {
    const body = (
        <>
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{Number(value ?? 0).toLocaleString()}</p>
            {hint && <p className="truncate text-[11px] text-gray-400">{hint}</p>}
        </>
    );
    const frame = `rounded-xl border bg-white px-4 py-3 text-left shadow-sm dark:bg-gray-800 ${active
        ? 'border-indigo-400 ring-2 ring-indigo-500/20 dark:border-indigo-500/60'
        : 'border-gray-100 dark:border-gray-700/60'}`;

    return onClick ? (
        <button type="button" onClick={onClick} aria-pressed={active} className={`${frame} hover:border-indigo-200 dark:hover:border-indigo-500/40`}>
            {body}
        </button>
    ) : (
        <div className={frame}>{body}</div>
    );
}

export default function Index({ auth, users, filters, roles, statuses, defaultStatusId, stats = {} }) {
    const [search, setSearch] = useState(filters.search || '');
    const [role, setRole] = useState(filters.role || '');
    const [status, setStatus] = useState(filters.status || '');
    const [confirming, setConfirming] = useState(null);
    const [settingPassword, setSettingPassword] = useState(null);
    const [adding, setAdding] = useState(false);
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

    const statusIdFor = (code) => statuses.find((s) => s.code === code)?.id;
    const countFor = (code) => Number(stats.by_code?.[code] ?? 0);
    const toggleStatus = (code) => {
        const id = String(statusIdFor(code) ?? '');
        setStatus((current) => (current === id ? '' : id));
    };

    const changeStatus = (user, statusId) => {
        router.patch(route('users.status', user.id), { status_id: statusId }, { preserveScroll: true });
    };

    const deleteUser = () => {
        router.delete(route('users.destroy', confirming.id), {
            preserveScroll: true,
            onFinish: () => setConfirming(null),
        });
    };

    /** The ⋮ menu: status changes live here rather than in a dropdown one stray click can trigger. */
    function rowActions(user) {
        const isSelf = user.id === auth.user.id;
        const items = [{ label: 'View profile', onSelect: () => router.visit(route('users.show', user.id)) }];

        if (isSelf) {
            items.push({ label: 'Change your password', onSelect: () => router.visit(route('profile.edit')) });
            return items;
        }

        items.push({ label: 'Issue one-time password…', onSelect: () => setSettingPassword(user) });

        const assignable = statuses.filter((s) => s.selectable !== false);
        const fixed = !assignable.some((s) => s.id === user.status_id);
        for (const option of assignable.filter((s) => s.id !== user.status_id)) {
            items.push({
                label: option.code === ACTIVE ? 'Activate' : `Mark as ${option.label.toLowerCase()}`,
                onSelect: () => changeStatus(user, option.id),
                disabled: fixed,
                hint: fixed ? 'This account holds a status user management does not assign.' : undefined,
            });
        }

        items.push({ label: 'Delete…', onSelect: () => setConfirming(user), danger: true });
        return items;
    }

    const filtered = Boolean(search || role || status);

    return (
        <AuthenticatedLayout>
            <Head title="User List" />

            <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">User List</h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Everyone who can sign in, their role, and whether their account is open.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="inline-flex items-center gap-1.5 self-start rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:self-auto dark:focus-visible:ring-offset-gray-900"
                    >
                        <UserPlus className="h-4 w-4" />
                        Add user
                    </button>
                </div>

                {/* At a glance — the status tiles double as filters */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Stat
                        icon={Users}
                        label="Accounts"
                        value={stats.total}
                        hint={`${Number(stats.active_today ?? 0)} active today`}
                        active={!status}
                        onClick={() => setStatus('')}
                    />
                    <Stat icon={UserCheck} label="Active" value={countFor(ACTIVE)} hint="Can sign in" active={status === String(statusIdFor(ACTIVE))} onClick={() => toggleStatus(ACTIVE)} />
                    <Stat icon={Ban} label="Inactive" value={countFor(INACTIVE)} hint="Refused at sign-in" active={status === String(statusIdFor(INACTIVE))} onClick={() => toggleStatus(INACTIVE)} />
                    <Stat icon={Lock} label="Locked" value={countFor(LOCKED)} hint="Refused at sign-in" active={status === String(statusIdFor(LOCKED))} onClick={() => toggleStatus(LOCKED)} />
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm lg:flex-row lg:items-center dark:border-gray-700/60 dark:bg-gray-800">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name or employee ID…"
                            aria-label="Search users"
                            className={`w-full py-2 pl-9 pr-3 ${selectClass}`}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role" className={selectClass}>
                            <option value="">Every role</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                        </select>
                        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className={selectClass}>
                            <option value="">Every status</option>
                            {statuses.map((s) => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                        </select>
                        {filtered && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch('');
                                    setRole('');
                                    setStatus('');
                                }}
                                className="text-xs text-gray-500 hover:text-indigo-600 hover:underline dark:text-gray-400 dark:hover:text-indigo-400"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Users */}
                <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/30">
                                <tr className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                    <th className="px-5 py-2.5">Person</th>
                                    <th className="px-4 py-2.5">Role</th>
                                    <th className="px-4 py-2.5">Status</th>
                                    <th className="px-4 py-2.5">Last active</th>
                                    <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                {users.data.map((user) => {
                                    const isSelf = user.id === auth.user.id;
                                    return (
                                        <tr key={user.id} className={`hover:bg-gray-50/60 dark:hover:bg-gray-900/20 ${user.is_active ? '' : 'opacity-75'}`}>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        aria-hidden="true"
                                                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${user.is_active
                                                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                                                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}
                                                    >
                                                        {initialsOf(user.emp_fname, user.emp_lname)}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <Link
                                                            href={route('users.show', user.id)}
                                                            className="text-sm font-medium text-gray-900 hover:text-indigo-600 hover:underline dark:text-gray-100 dark:hover:text-indigo-400"
                                                        >
                                                            {user.name}
                                                        </Link>
                                                        {isSelf && (
                                                            <span className="ml-2 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                                                                You
                                                            </span>
                                                        )}
                                                        <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400">{user.emp_id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{user.role ?? 'No role'}</p>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400">{user.section}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge code={user.status_code} label={user.status} />
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300" title={user.last_active ? formatDateTime(user.last_active) : undefined}>
                                                {lastSeen(user.last_active) ?? <span className="text-gray-400">Never</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end">
                                                    <RowActionsMenu label={`Actions for ${user.name}`} items={rowActions(user)} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {users.data.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-16 text-center">
                                            <Users className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">No users match</p>
                                            <p className="mt-1 text-xs text-gray-500">Try a different name, employee ID, role or status.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {users.links?.length > 3 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700/60 dark:bg-gray-900/20">
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">{users.from}–{users.to} of {users.total}</p>
                            <div className="flex flex-wrap gap-1">
                                {users.links.map((link, index) => (
                                    <Link
                                        key={index}
                                        href={link.url ?? '#'}
                                        preserveState
                                        preserveScroll
                                        className={`rounded-md border px-2.5 py-1 text-[11px] transition-all ${link.active
                                            ? 'border-indigo-600 bg-indigo-600 text-white'
                                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-900/40'} ${!link.url ? 'pointer-events-none opacity-50' : ''}`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </div>

            <AddUserModal
                show={adding}
                onClose={() => setAdding(false)}
                roles={roles}
                statuses={statuses}
                defaultStatusId={defaultStatusId}
            />

            <SetPasswordModal user={settingPassword} onClose={() => setSettingPassword(null)} />

            <TemporaryPasswordModal />

            <Modal show={confirming !== null} onClose={() => setConfirming(null)} maxWidth="md">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete {confirming?.name}?</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        This permanently removes employee {confirming?.emp_id}. If they have submitted requests or
                        records, mark them inactive instead so the history stays intact.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={() => setConfirming(null)}>Cancel</SecondaryButton>
                        <DangerButton onClick={deleteUser}>Delete user</DangerButton>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
