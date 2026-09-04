import DeptPie from './DeptPie';
import LiveClock from './LiveClock';
import PrTable from './PrTable';
import StatCards from './StatCard';
import WelcomeCard from './WelcomeCard';

/**
 * The single source of truth for "what can appear on a dashboard".
 *
 * The backend sends an ordered array of keys; this maps each key to a
 * component, how wide it sits in the 12-column grid, and any fixed props.
 * Note `recentPrs` and `verifiedByMe` are the same component with different
 * props — that reuse is the whole reason not to split by role.
 */
export const WIDGET_REGISTRY = {
    welcome: { component: WelcomeCard, span: 'half' },
    clock: { component: LiveClock, span: 'half' },
    stats: { component: StatCards, span: 'full' },
    deptPie: { component: DeptPie, span: 'full' },

    recentPrs: {
        component: PrTable,
        span: 'full',
        props: {
            title: 'Recent purchase requests',
            emptyLabel: 'No purchase requests yet.',
            viewMoreHref: '/purchase-requests',
        },
    },

    verifiedByMe: {
        component: PrTable,
        span: 'full',
        props: {
            title: 'Verified by you',
            emptyLabel: "You haven't verified any requests yet.",
            viewMoreHref: '/pr-monitoring?verified_by=me',
        },
    },

    myRequests: {
        component: PrTable,
        span: 'full',
        props: {
            title: 'Your requests',
            emptyLabel: "You haven't filed any requests yet.",
            viewMoreHref: '/purchase-requests?requester=me',
        },
    },

    canvassQueue: {
        component: PrTable,
        span: 'full',
        props: {
            title: 'Waiting for canvassing',
            emptyLabel: 'Nothing in the canvassing queue.',
            viewMoreHref: '/purchase-requests?status=200',
        },
    },
};

/**
 * Written out in full because Tailwind scans source for complete class
 * strings — `lg:col-span-${n}` would get purged from the build.
 */
export const SPAN_CLASSES = {
    full: 'lg:col-span-12',
    half: 'lg:col-span-6',
    third: 'lg:col-span-4',
    quarter: 'lg:col-span-3',
};
