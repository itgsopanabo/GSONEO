export default function WelcomeCard({ auth }) {
    const user = auth?.user;
    if (!user) return null;

    const role = user.role?.role_name ?? 'No role assigned';
    const section = user.role?.section;

    return (
        <div className="h-full overflow-hidden bg-white shadow-sm sm:rounded-lg dark:bg-gray-800">
            <div className="p-6 text-gray-900 dark:text-gray-100">
                <h3 className="text-lg font-medium">
                    Welcome back,{' '}
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {user.emp_lname}, {user.emp_fname}
                    </span>
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Employee ID: {user.emp_id}
                </p>
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Assigned role:{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {role}
                        {section ? ` (${section})` : ''}
                    </span>
                </p>
            </div>
        </div>
    );
}
