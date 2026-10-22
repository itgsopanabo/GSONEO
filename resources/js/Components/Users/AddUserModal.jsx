import { useEffect, useState } from 'react';
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
 * Adds an account. New users start on the shared default password unless the
 * admin types one, and are made to choose their own at first sign-in.
 */
export default function AddUserModal({ show, onClose, roles = [], statuses = [], defaultStatusId, defaultPassword }) {
    const canUseDefault = Boolean(defaultPassword);
    const [visible, setVisible] = useState(false);
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        emp_id: '',
        emp_fname: '',
        emp_lname: '',
        role_id: '',
        status_id: defaultStatusId ?? '',
        use_default_password: canUseDefault,
        password: '',
        password_confirmation: '',
    });

    // Start with a clean form every time the dialog opens.
    useEffect(() => {
        if (show) {
            reset();
            clearErrors();
            setVisible(false);
        }
    }, [show]);

    const close = () => {
        if (processing) return;
        onClose();
    };

    const submit = (e) => {
        e.preventDefault();
        post(route('users.store'), {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    const needsPassword = !data.use_default_password;
    const incomplete =
        !data.emp_id ||
        !data.emp_fname.trim() ||
        !data.emp_lname.trim() ||
        !data.role_id ||
        !data.status_id ||
        (needsPassword && (!data.password || !data.password_confirmation));

    return (
        <Modal show={show} onClose={close} maxWidth="lg">
            <form onSubmit={submit} className="p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Add user</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    The employee signs in with their employee ID.
                </p>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <InputLabel htmlFor="add-emp-id" value="Employee ID" />
                        <TextInput
                            id="add-emp-id"
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={data.emp_id}
                            onChange={(e) => setData('emp_id', e.target.value)}
                            className="mt-1 block w-full font-mono"
                            isFocused
                        />
                        <InputError message={errors.emp_id} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="add-fname" value="First name" />
                        <TextInput
                            id="add-fname"
                            value={data.emp_fname}
                            onChange={(e) => setData('emp_fname', e.target.value)}
                            autoComplete="off"
                            className="mt-1 block w-full"
                        />
                        <InputError message={errors.emp_fname} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="add-lname" value="Last name" />
                        <TextInput
                            id="add-lname"
                            value={data.emp_lname}
                            onChange={(e) => setData('emp_lname', e.target.value)}
                            autoComplete="off"
                            className="mt-1 block w-full"
                        />
                        <InputError message={errors.emp_lname} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="add-role" value="Role" />
                        <select
                            id="add-role"
                            value={data.role_id}
                            onChange={(e) => setData('role_id', e.target.value)}
                            className={selectClasses}
                        >
                            <option value="">Select a role</option>
                            {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                    {role.label}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.role_id} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="add-status" value="Status" />
                        <select
                            id="add-status"
                            value={data.status_id}
                            onChange={(e) => setData('status_id', e.target.value)}
                            className={selectClasses}
                        >
                            {statuses.map((status) => (
                                <option key={status.id} value={status.id}>
                                    {status.label}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.status_id} className="mt-2" />
                    </div>

                    <div className="sm:col-span-2 rounded-md border border-gray-200 p-4 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</p>

                        {canUseDefault && (
                            <label className="mt-2 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={data.use_default_password}
                                    onChange={(e) => setData('use_default_password', e.target.checked)}
                                    className="mt-0.5 rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                                />
                                <span>
                                    Start with the default password
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                                        They sign in with <span className="font-mono">{defaultPassword}</span> and
                                        must choose their own password right away.
                                    </span>
                                </span>
                            </label>
                        )}

                        {needsPassword && (
                            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <InputLabel htmlFor="add-password" value="Password" />
                                    <TextInput
                                        id="add-password"
                                        type={visible ? 'text' : 'password'}
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        autoComplete="new-password"
                                        className="mt-1 block w-full"
                                    />
                                    <InputError message={errors.password} className="mt-2" />
                                </div>
                                <div>
                                    <InputLabel htmlFor="add-password-confirmation" value="Type it again" />
                                    <TextInput
                                        id="add-password-confirmation"
                                        type={visible ? 'text' : 'password'}
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        autoComplete="new-password"
                                        className="mt-1 block w-full"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setVisible((v) => !v)}
                                    className="justify-self-start text-xs font-medium text-gray-600 hover:underline dark:text-gray-300"
                                >
                                    {visible ? 'Hide password' : 'Show password'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <SecondaryButton type="button" onClick={close} disabled={processing}>
                        Cancel
                    </SecondaryButton>
                    <PrimaryButton disabled={processing || incomplete}>
                        {processing ? 'Adding…' : 'Add user'}
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}
