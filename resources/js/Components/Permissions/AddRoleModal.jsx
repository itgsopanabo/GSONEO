import { useEffect, useMemo } from 'react';
import { useForm } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';

const selectClasses =
    'mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';

/**
 * Adds a role. It starts with no permissions unless another role is picked to
 * copy from; either way the admin fine-tunes them on the page afterwards.
 */
export default function AddRoleModal({ show, onClose, onCreated, roles = [] }) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        role_name: '',
        section: '',
        copy_from_role_id: '',
    });

    const sections = useMemo(() => [...new Set(roles.map((r) => r.section))].sort(), [roles]);

    // Start with a clean form every time the dialog opens.
    useEffect(() => {
        if (show) {
            reset();
            clearErrors();
        }
    }, [show]);

    const close = () => {
        if (processing) return;
        onClose();
    };

    const submit = (e) => {
        e.preventDefault();
        const name = data.role_name.trim();
        const section = data.section.trim();
        post(route('permissions.store'), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: (page) => {
                const created = page.props.roles?.find((r) => r.role_name === name && r.section === section);
                onClose();
                if (created) onCreated?.(created.id);
            },
        });
    };

    const incomplete = !data.role_name.trim() || !data.section.trim();

    return (
        <Modal show={show} onClose={close} maxWidth="lg">
            <form onSubmit={submit} className="p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">New role</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Roles are grouped by section. You can set its permissions right after it is created.
                </p>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <InputLabel htmlFor="add-role-name" value="Role name" />
                        <TextInput
                            id="add-role-name"
                            value={data.role_name}
                            onChange={(e) => setData('role_name', e.target.value)}
                            autoComplete="off"
                            maxLength={255}
                            className="mt-1 block w-full"
                            isFocused
                        />
                        <InputError message={errors.role_name} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="add-role-section" value="Section" />
                        <TextInput
                            id="add-role-section"
                            list="add-role-sections"
                            value={data.section}
                            onChange={(e) => setData('section', e.target.value)}
                            autoComplete="off"
                            maxLength={255}
                            placeholder="Pick or type a new one"
                            className="mt-1 block w-full"
                        />
                        <datalist id="add-role-sections">
                            {sections.map((s) => (
                                <option key={s} value={s} />
                            ))}
                        </datalist>
                        <InputError message={errors.section} className="mt-2" />
                    </div>

                    <div className="sm:col-span-2">
                        <InputLabel htmlFor="add-role-copy" value="Start with permissions from (optional)" />
                        <select
                            id="add-role-copy"
                            value={data.copy_from_role_id}
                            onChange={(e) => setData('copy_from_role_id', e.target.value)}
                            className={selectClasses}
                        >
                            <option value="">No permissions</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.role_name} ({r.section})
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.copy_from_role_id} className="mt-2" />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <SecondaryButton type="button" onClick={close} disabled={processing}>
                        Cancel
                    </SecondaryButton>
                    <PrimaryButton disabled={processing || incomplete}>
                        {processing ? 'Creating…' : 'Create role'}
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}
