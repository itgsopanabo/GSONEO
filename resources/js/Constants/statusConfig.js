// resources/js/constants/statusConfig.js

export const STATUS_MAP = {
    0: {
        label: 'Draft',
        style: 'bg-gray-50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
    },
    // Workflow (PR Pipeline)
    1: {
        label: 'Pending',
        style: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    },

    // Verified — one shade per procurement mode
    100: {
        label: 'Verified',
        style: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
    },
    // 110: {
    //     label: 'Verified for PhilGeps/RFQ',
    //     style: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800'
    // },
    // 120: {
    //     label: 'Verified for Public Bidding',
    //     style: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
    // },
    // 130: {
    //     label: 'Verified for Agency to Agency',
    //     style: 'bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-800'
    // },

    // Canvassing — same hue, deeper shade for the later step
    200: {
        label: 'Canvassing',
        style: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
    },
    205: {
        label: 'Printed Canvas',
        style: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'
    },

    // Purchase Order — same hue, deeper shade for the later step
    210: {
        label: 'Receive Purchase Order',
        style: 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800'
    },
    230: {
        label: 'PO Generated',
        style: 'bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-300 border-pink-300 dark:border-pink-700'
    },

    300: {
        label: 'For Inspection',
        style: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800'
    },
    400: {
        label: 'For RIS',
        style: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800'
    },
    500: {
        label: 'For SSMI',
        style: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800'
    },
    550: {
        label: 'For Outgoing',
        style: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'
    },

    600: {
        label: 'Completed',
        style: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
    },

    700: {
        label: 'Rejected',
        style: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
    },

    // Cancelled by an administrator. Deliberately not red: it is a closed record,
    // not a rejected one, and the two should not read as the same outcome.
    800: {
        label: 'Cancelled',
        style: 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
    },

    // Account State
    900: {
        label: 'Active',
        style: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
    },
    901: {
        label: 'Inactive',
        style: 'bg-slate-50 dark:bg-slate-900/20 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800'
    },
    902: {
        label: 'Locked',
        style: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
    },
};

export const getStatusConfig = (statusCode) => {
    return STATUS_MAP[statusCode] ?? {
        label: 'Unknown',
        style: 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800'
    };
};
