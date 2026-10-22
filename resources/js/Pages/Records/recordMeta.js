// resources/js/Pages/Records/recordMeta.js
//
// Shared display logic for record sensitivity and retention state.
// One file so the table badge, the detail banner and the form preview
// can never disagree with each other.

import { formatDate } from '@/Utils/formatDate.js';

export const SENSITIVITY = {
    public: {
        label: 'Public',
        stripe: 'border-l-emerald-600',
        chip: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
        note: 'Disclosable on request.',
    },
    internal: {
        label: 'Internal',
        stripe: 'border-l-gray-300 dark:border-l-gray-600',
        chip: 'bg-gray-100 text-gray-700 ring-gray-400/30 dark:bg-gray-700/50 dark:text-gray-300 dark:ring-gray-500/30',
        note: 'Office use. Not for release without approval.',
    },
    restricted: {
        label: 'Restricted',
        stripe: 'border-l-amber-600',
        chip: 'bg-amber-50 text-amber-900 ring-amber-600/30 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
        note: 'Access limited and logged. Land titles and property documents.',
    },
};

export const sensitivityOf = (key) => SENSITIVITY[key] ?? SENSITIVITY.internal;

export const STATUS_LABELS = {
    active: 'In office',
    storage: 'In records storage',
    for_disposal: 'Proposed for disposal',
    disposed: 'Disposed',
    transferred_to_nap: 'Transferred to National Archives',
};

export const TRIGGERS = {
    creation: 'the date of the record',
    audit_settlement: 'the audit being settled',
    asset_disposal: 'the asset being disposed',
    contract_completion: 'the contract being completed',
};

/**
 * Turns the raw disposal date into what a records officer needs to know.
 * A null date means one of two very different things: permanent records are
 * never destroyed, while a record whose trigger has not fired is simply not
 * counting down yet. Collapsing those two into "no date" is the mistake this
 * function exists to prevent.
 */
export function retentionState(record) {
    const cls = record.record_class ?? {};

    if (cls.is_permanent) {
        return {
            label: 'Permanent',
            detail: 'Never disposed. Transfers to the National Archives.',
            tone: 'text-indigo-900 bg-indigo-50 ring-indigo-600/20 dark:text-indigo-300 dark:bg-indigo-500/10 dark:ring-indigo-400/20',
        };
    }

    if (!record.eligible_for_disposal_on) {
        return {
            label: 'Not yet counting',
            detail: 'Retention starts when the trigger event is recorded.',
            tone: 'text-gray-600 bg-gray-100 ring-gray-400/30 dark:text-gray-400 dark:bg-gray-700/50 dark:ring-gray-500/30',
        };
    }

    const due = new Date(record.eligible_for_disposal_on);
    const year = due.getFullYear();

    if (due <= new Date()) {
        return {
            label: `Eligible since ${year}`,
            detail: 'Requires written authority from the NAP Executive Director before disposal.',
            tone: 'text-rose-900 bg-rose-50 ring-rose-600/20 dark:text-rose-300 dark:bg-rose-500/10 dark:ring-rose-400/20',
        };
    }

    return {
        label: `Eligible ${year}`,
        detail: formatDate(due),
        tone: 'text-gray-700 bg-white ring-gray-300 dark:text-gray-300 dark:bg-gray-800 dark:ring-gray-600',
    };
}

export { formatDate };

/** Client-side mirror of Record::computeDisposalDate(), for the form preview. */
export function previewDisposal(cls, retentionStartsOn) {
    if (!cls) return null;
    if (cls.is_permanent) return { permanent: true };
    if (!cls.retention_years) return { unset: true };
    if (!retentionStartsOn) return { waiting: true };

    const d = new Date(retentionStartsOn);
    d.setFullYear(d.getFullYear() + Number(cls.retention_years));
    return { date: d };
}
