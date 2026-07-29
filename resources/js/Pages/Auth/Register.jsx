import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import {Head, Link, useForm} from '@inertiajs/react';

export default function Register({roles = []}) {
    const {data, setData, post, processing, errors, reset} = useForm({
        empID: '', fname: '', lname: '', role_id: '', password: '', password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (<GuestLayout>
        <Head title="Register"/>

        <form onSubmit={submit}>
            <div>
                <InputLabel htmlFor="empID" value="Employee ID"/>

                <TextInput
                    id="empID"
                    name="empID"
                    value={data.empID}
                    className="mt-1 block w-full"
                    autoComplete="off"
                    isFocused={true}
                    onChange={(e) => setData('empID', e.target.value)}
                    required
                />

                <InputError message={errors.empID} className="mt-2"/>
            </div>

            <div className="mt-4">
                <InputLabel htmlFor="fname" value="Employee Firstname"/>

                <TextInput
                    id="fname"
                    name="fname"
                    value={data.fname}
                    className="mt-1 block w-full"
                    autoComplete="name"
                    onChange={(e) => setData('fname', e.target.value)}
                    required
                />

                <InputError message={errors.name} className="mt-2"/>
            </div>


            <div className="mt-4">
                <InputLabel htmlFor="lname" value="Employee Lastname"/>

                <TextInput
                    id="lname"
                    name="lname"
                    value={data.lname}
                    className="mt-1 block w-full"
                    autoComplete="name"
                    onChange={(e) => setData('lname', e.target.value)}
                    required
                />

                <InputError message={errors.name} className="mt-2"/>
            </div>

            <div className="mt-4 space-y-1.5">
                <InputLabel htmlFor="role_id" value="Role"
                            className="text-xs uppercase font-semibold tracking-wider text-gray-500 dark:text-zinc-400"/>

                <div className="relative">
                    <select
                        id="role_id"
                        name="role_id"
                        value={data.role_id}
                        className="mt-1 block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all duration-200 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm text-sm text-gray-900 dark:text-zinc-100 py-2.5 px-3 appearance-none cursor-pointer"
                        onChange={(e) => {
                            const value = e.target.value;
                            setData('role_id', value === "" ? "" : Number(value));
                        }}
                        required
                    >
                        {/* 🌟 ADD THIS NEW DEFAULT OPTION HERE */}
                        <option value="" disabled className="text-gray-400">
                            -- Select your position --
                        </option>

                        {/* Your optgroup rendering logic remains exactly the same below */}
                        {Object.entries(roles.reduce((groups, role) => {
                            const group = role.section || 'Other';
                            if (!groups[group]) groups[group] = [];
                            groups[group].push(role);
                            return groups;
                        }, {})).map(([sectionName, sectionRoles]) => (<optgroup key={sectionName} label={sectionName}
                                                                                className="font-bold text-indigo-600 dark:bg-zinc-900">
                            {sectionRoles.map((role) => (<option key={role.id} value={role.id}
                                                                 className="font-normal text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-900">
                                {role.role_name}
                            </option>))}
                        </optgroup>))}
                    </select>

                    {/* Custom Dropdown Chevron Icon */}
                    <div
                        className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 dark:text-zinc-400">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg"
                             viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                        </svg>
                    </div>
                </div>

                <InputError message={errors.role_id} className="mt-1 text-xs"/>
            </div>

            <div className="mt-4">
                <InputLabel htmlFor="password" value="Password"/>

                <TextInput
                    id="password"
                    type="password"
                    name="password"
                    value={data.password}
                    className="mt-1 block w-full"
                    autoComplete="new-password"
                    onChange={(e) => setData('password', e.target.value)}
                    required
                />

                <InputError message={errors.password} className="mt-2"/>
            </div>

            <div className="mt-4">
                <InputLabel
                    htmlFor="password_confirmation"
                    value="Confirm Password"
                />

                <TextInput
                    id="password_confirmation"
                    type="password"
                    name="password_confirmation"
                    value={data.password_confirmation}
                    className="mt-1 block w-full"
                    autoComplete="new-password"
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    required
                />

                <InputError
                    message={errors.password_confirmation}
                    className="mt-2"
                />
            </div>

            <div className="mt-4 flex items-center justify-end">
                <Link
                    href={route('login')}
                    className="rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:text-gray-400 dark:hover:text-gray-100 dark:focus:ring-offset-gray-800"
                >
                    Already registered?
                </Link>

                <PrimaryButton className="ms-4" disabled={processing}>
                    Register
                </PrimaryButton>
            </div>
        </form>
    </GuestLayout>);
}
