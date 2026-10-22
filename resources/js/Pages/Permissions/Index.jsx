import { useEffect, useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

const sameSet = (a, b) => a.size === b.size && [...a].every((id) => b.has(id));

export default function Index({ roles, permissions, ownRoleId, protectedOnOwnRole = [] }) {
    const [roleId, setRoleId] = useState(roles[0]?.id ?? null);
    const role = roles.find((r) => r.id === roleId) ?? null;
    const saved = useMemo(() => new Set(role?.permission_ids ?? []), [role]);
    const [selected, setSelected] = useState(saved);
    const [saving, setSaving] = useState(false);

    // Load the saved set whenever another role is picked or a save comes back.
    useEffect(() => setSelected(new Set(saved)), [saved]);

    const dirty = !sameSet(selected, saved);
    const isOwnRole = role?.id === ownRoleId;
    const locked = (id) => isOwnRole && protectedOnOwnRole.includes(id);

    const rolesBySection = useMemo(
        () => roles.reduce((groups, r) => ((groups[r.section] ??= []).push(r), groups), {}),
        [roles],
    );
    const permissionGroups = useMemo(
        () => permissions.reduce((groups, p) => ((groups[p.group] ??= []).push(p), groups), {}),
        [permissions],
    );

    const pickRole = (id) => {
        if (id === roleId) return;
        if (dirty && !window.confirm('Discard the unsaved changes to this role?')) return;
        setRoleId(id);
    };

    const toggle = (id) => {
        if (locked(id)) return;
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const setGroup = (items, on) =>
        setSelected((prev) => {
            const next = new Set(prev);
            items.forEach((p) => (on ? next.add(p.id) : !locked(p.id) && next.delete(p.id)));
            return next;
        });

    const save = () => {
        setSaving(true);
        router.put(
            route('permissions.update', role.id),
            { permission_ids: [...selected] },
            { preserveScroll: true, preserveState: true, onFinish: () => setSaving(false) },
        );
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    Roles &amp; permissions
                </h2>
            }
        >
            <Head title="Roles & permissions" />

            <div className="py-8">
                <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-[18rem_1fr] lg:px-8">
                    {/* Roles */}
                    <nav aria-label="Roles" className="overflow-hidden bg-white shadow-sm dark:bg-gray-800 sm:rounded-lg lg:self-start">
                        {Object.entries(rolesBySection).map(([section, sectionRoles]) => (
                            <div key={section} className="border-b border-gray-100 last:border-0 dark:border-gray-700">
                                <p className="bg-gray-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
                                    {section}
                                </p>
                                <ul>
                                    {sectionRoles.map((r) => {
                                        const active = r.id === roleId;
                                        return (
                                            <li key={r.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => pickRole(r.id)}
                                                    aria-current={active ? 'true' : undefined}
                                                    className={`flex w-full items-center justify-between gap-2 border-l-2 px-4 py-2.5 text-left text-sm transition-colors ${
                                                        active
                                                            ? 'border-indigo-600 bg-indigo-50/70 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                                                            : 'border-transparent text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/40'
                                                    }`}
                                                >
                                                    <span className="truncate">{r.role_name}</span>
                                                    <span className="shrink-0 text-xs text-gray-400">
                                                        {r.users_count} {r.users_count === 1 ? 'user' : 'users'}
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>

                    {/* Permissions for the selected role */}
                    {role && (
                        <section className="bg-white shadow-sm dark:bg-gray-800 sm:rounded-lg">
                            <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800 sm:rounded-t-lg">
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                        {role.role_name} <span className="font-normal text-gray-400">· {role.section}</span>
                                    </h3>
                                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                        {selected.size} of {permissions.length} permissions ·{' '}
                                        {role.users_count} {role.users_count === 1 ? 'user has' : 'users have'} this role
                                        {isOwnRole && ' · your role'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {dirty && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>}
                                    <SecondaryButton onClick={() => setSelected(new Set(saved))} disabled={!dirty || saving}>
                                        Reset
                                    </SecondaryButton>
                                    <PrimaryButton onClick={save} disabled={!dirty || saving}>
                                        {saving ? 'Saving…' : 'Save changes'}
                                    </PrimaryButton>
                                </div>
                            </header>

                            <p className="border-b border-gray-100 px-6 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                Changes apply to everyone with this role on their next page load.
                            </p>

                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {Object.entries(permissionGroups).map(([group, items]) => {
                                    const onCount = items.filter((p) => selected.has(p.id)).length;
                                    return (
                                        <fieldset key={group} className="px-6 py-5">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <legend className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                                    {group}
                                                    <span className="ml-2 text-xs font-normal text-gray-400">
                                                        {onCount}/{items.length}
                                                    </span>
                                                </legend>
                                                <div className="flex gap-3 text-xs">
                                                    <button type="button" onClick={() => setGroup(items, true)} className="text-indigo-600 hover:underline dark:text-indigo-400">
                                                        Select all
                                                    </button>
                                                    <button type="button" onClick={() => setGroup(items, false)} className="text-gray-500 hover:underline dark:text-gray-400">
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                {items.map((p) => (
                                                    <label
                                                        key={p.id}
                                                        className={`flex items-start gap-3 rounded-md border px-3 py-2.5 ${
                                                            selected.has(p.id)
                                                                ? 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/30 dark:bg-indigo-500/5'
                                                                : 'border-gray-200 dark:border-gray-700'
                                                        } ${locked(p.id) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selected.has(p.id)}
                                                            disabled={locked(p.id)}
                                                            onChange={() => toggle(p.id)}
                                                            className="mt-0.5 rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900"
                                                        />
                                                        <span className="min-w-0">
                                                            <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">{p.label}</span>
                                                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                                                                {locked(p.id) ? 'Cannot be removed from your own role.' : p.description}
                                                            </span>
                                                            <code className="mt-0.5 block text-[11px] text-gray-400">{p.name}</code>
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </fieldset>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
