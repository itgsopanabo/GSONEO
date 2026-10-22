import CalendarWidget from './CalendarWidget';
import ComingSoonCard from './ComingSoonCard';
import MissingTrackerWidget from './MissingTrackerWidget';
import MonthlyTrend from './MonthlyTrend';
import RecentActivity from './RecentActivity';
import StageBars from './StageBars';
import StatCards from './StatCard';
import WelcomeCard from './WelcomeCard';
import WorkQueue from './WorkQueue';

/**
 * The single source of truth for "what can appear on a dashboard".
 *
 * The backend (config/dashboard.php) sends an ordered array of keys; this maps
 * each key to a component, how wide it sits in the 12-column grid, and any
 * fixed props. The queues are one component with different props.
 *
 * `info` is the text behind the ⓘ on the card's title — what it counts and what
 * it leaves out. It lives here so every card is explained in one place, and so
 * the answer is next to the definition it describes.
 */
export const WIDGET_REGISTRY = {
    // The greeting carries the live date and time; there is no separate clock.
    welcome: { component: WelcomeCard, span: 'full' },
    stats: { component: StatCards, span: 'full' },

    calendar: {
        component: CalendarWidget,
        span: 'full',
        props: {
            info: 'Holidays, meetings, deadlines and other activities, shown to everyone. Administrators with the Calendar events permission add and change them here.',
        },
    },

    missingTracker: {
        component: MissingTrackerWidget,
        span: 'half',
        props: {
            info: 'Open missing tags on purchase orders, longest-open first. A tag with a lock holds its order at the current stage until it is resolved.',
        },
    },

    monthlyTrend: {
        component: MonthlyTrend,
        span: 'full',
        props: {
            info: 'Purchase requests filed and purchase orders numbered in each of the last 12 months, counted by the month they were created.',
        },
    },

    prPipeline: {
        component: StageBars,
        span: 'half',
        props: {
            title: 'Purchase requests by stage',
            unit: 'request',
            info: 'Every purchase request still in the pipeline, grouped by the stage it is sitting at now. Completed, declined and cancelled requests are not counted.',
        },
    },
    poPipeline: {
        component: StageBars,
        span: 'half',
        props: {
            title: 'Purchase orders by stage',
            unit: 'order',
            info: 'Purchase orders moving through inventory — delivery, inspection, RIS, SSMI and release — grouped by where each one is now.',
        },
    },
    deptChart: {
        component: StageBars,
        span: 'half',
        props: {
            title: 'Requests by department',
            unit: 'request',
            info: 'How many purchase requests each department has filed, at any stage, including completed ones.',
        },
    },
    recentActivity: {
        component: RecentActivity,
        span: 'half',
        props: {
            info: 'The latest entries in the audit trail: who changed what, across every module.',
        },
    },

    draftQueue: {
        component: WorkQueue,
        span: 'half',
        props: {
            title: 'Drafts to finish',
            numberLabel: 'PR number',
            dateLabel: 'Last saved',
            emptyLabel: 'No drafts. Everything has been submitted.',
            info: 'Requests started but not yet submitted. Nobody else acts on these until they are submitted for verification.',
        },
    },
    verifyQueue: {
        component: WorkQueue,
        span: 'half',
        props: {
            title: 'Waiting for verification',
            numberLabel: 'PR number',
            emptyLabel: 'No requests are waiting for verification.',
            info: 'Submitted requests waiting to be accepted or declined. The age is how long each one has been waiting.',
        },
    },
    canvassQueue: {
        component: WorkQueue,
        span: 'half',
        props: {
            title: 'Ready for canvassing',
            numberLabel: 'PR number',
            emptyLabel: 'Nothing is waiting for canvassing.',
            info: 'Verified requests that still need a canvass form prepared and printed.',
        },
    },
    poQueue: {
        component: WorkQueue,
        span: 'half',
        props: {
            title: 'Waiting for a purchase order',
            numberLabel: 'PR number',
            emptyLabel: 'No requests are waiting for a PO.',
            info: 'Canvassed requests waiting for a PO number to be issued against a supplier.',
        },
    },
    incomingQueue: {
        component: WorkQueue,
        span: 'half',
        props: {
            title: 'Incoming deliveries',
            numberLabel: 'PO number',
            emptyLabel: 'No deliveries are expected.',
            info: 'Numbered purchase orders whose goods have not arrived yet. Receiving one sends it on for inspection.',
        },
    },
    outgoingQueue: {
        component: WorkQueue,
        span: 'half',
        props: {
            title: 'Ready for release',
            numberLabel: 'PO number',
            emptyLabel: 'Nothing is waiting to be released.',
            info: 'Orders with an SSMI issued, waiting to be handed to the requesting department. Releasing one completes it.',
        },
    },
    iarQueue: {
        component: WorkQueue,
        span: 'half',
        props: {
            title: 'Waiting for IAR',
            numberLabel: 'PO number',
            emptyLabel: 'No deliveries are waiting for inspection.',
            info: 'Deliveries received but not yet inspected. An Inspection and Acceptance Report is the next step.',
        },
    },
    risQueue: {
        component: WorkQueue,
        span: 'half',
        props: {
            title: 'Waiting for RIS',
            numberLabel: 'PO number',
            emptyLabel: 'Nothing is waiting for a RIS.',
            info: 'Inspected orders waiting for a Requisition and Issue Slip number.',
        },
    },
    ssmiQueue: {
        component: WorkQueue,
        span: 'half',
        props: {
            title: 'Waiting for SSMI',
            numberLabel: 'PO number',
            emptyLabel: 'Nothing is waiting for an SSMI.',
            info: 'Orders with a RIS issued, waiting for an SSMI number before they can be released.',
        },
    },
    disposalQueue: {
        component: WorkQueue,
        span: 'full',
        props: {
            title: 'Records due for disposal',
            numberLabel: 'Record',
            dateLabel: 'Eligible on',
            showAge: false,
            emptyLabel: 'No records are due for disposal in the next 90 days.',
            info: 'Archived records whose retention period ends within 90 days. Disposal itself still needs approval outside the system.',
        },
    },

    recentPrs: {
        component: WorkQueue,
        span: 'full',
        props: {
            title: 'Latest purchase requests',
            numberLabel: 'PR number',
            dateLabel: 'Filed on',
            showAge: false,
            emptyLabel: 'No purchase requests yet.',
            info: 'The most recently filed requests across every department, whatever stage they have reached.',
        },
    },

    comingSoon: { component: ComingSoonCard, span: 'full' },
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
