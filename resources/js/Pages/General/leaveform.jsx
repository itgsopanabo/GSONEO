import { useState } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx';

const LEAVE_TYPES = [
    ['vacation', 'Vacation Leave'],
    ['mandatory', 'Mandatory/Forced Leave'],
    ['sick', 'Sick Leave'],
    ['maternity', 'Maternity Leave'],
    ['paternity', 'Paternity Leave'],
    ['special_privilege', 'Special Privilege Leave'],
    ['solo_parent', 'Solo Parent Leave'],
    ['study', 'Study Leave'],
    ['vawc', '10-Day VAWC Leave'],
    ['rehabilitation', 'Rehabilitation Privilege'],
    ['special_women', 'Special Leave Benefits for Women'],
    ['calamity', 'Special Emergency (Calamity) Leave'],
    ['adoption', 'Adoption Leave'],
];

const LEAVE_DETAILS = [
    ['within_ph', 'Within the Philippines'],
    ['abroad', 'Abroad'],
    ['in_hospital', 'In Hospital'],
    ['out_patient', 'Out Patient'],
    ['masters', "Completion of Master's Degree"],
    ['bar_board', 'BAR/Board Examination Review'],
    ['monetization', 'Monetization of Leave Credits'],
    ['terminal', 'Terminal Leave'],
];

// en-CA gives YYYY-MM-DD from the *local* clock. toISOString() would convert to
// UTC first, which rolls the date back a day before 8 AM in the Philippines.
const today = new Date().toLocaleDateString('en-CA');

export default function LeaveForm({ employee = null }) {
    const [fields, setFields] = useState({
        office: employee?.office ?? 'CGSO',
        last: employee?.last_name ?? '',
        first: employee?.first_name ?? '',
        middle: employee?.middle_name ?? '',
        position: employee?.position ?? '',
        salary: '',
        date_filing: today,
        within_ph: '',
        abroad: '',
        in_hospital: '',
        out_patient: '',
        women_illness: '',
        working_days: '',
        inclusive_dates: '',
        credits_as_of: '',
        vl_earned: '',
        sl_earned: '',
        vl_less: '',
        sl_less: '',
        vl_balance: '',
        sl_balance: '',
        days_with_pay: '',
        days_without_pay: '',
        days_others: '',
    });

    const [ticks, setTicks] = useState(['not_requested']);

    const set = (key) => (e) =>
        setFields((prev) => ({ ...prev, [key]: e.target.value }));

    const toggle = (key) =>
        setTicks((prev) =>
            prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key],
        );

    // Inertia's router does XHR, so build the URL by hand and open a new tab.
    const generate = () => {
        const params = new URLSearchParams();

        Object.entries(fields).forEach(([key, value]) => {
            // Compare against '' rather than testing truthiness so a legitimate
            // "0" in a credits field still reaches the printed form.
            if (value !== '' && value !== null && value !== undefined) {
                params.append(key, value);
            }
        });
        ticks.forEach((t) => params.append('ticks[]', t));

        window.open(`${route('leave.print')}?${params}`, '_blank', 'noopener');
    };

    const canGenerate = fields.last.trim() && fields.first.trim();

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">Application for Leave</h2>}>
            <Head title="Application for Leave" />

            <div className="py-8">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                    <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800 sm:p-8">

                        <p className="mb-8 text-sm text-gray-500 dark:text-gray-400">
                            CS Form No. 6 &middot; City Government of Panabo
                        </p>

                        <Section title="Employee">
                            <Row>
                                <Field label="Last name" value={fields.last} onChange={set('last')} required />
                                <Field label="First name" value={fields.first} onChange={set('first')} required />
                                <Field label="Middle name" value={fields.middle} onChange={set('middle')} />
                            </Row>
                            <Row>
                                <Field label="Office / Department" value={fields.office} onChange={set('office')} />
                                <Field label="Position" value={fields.position} onChange={set('position')} />
                            </Row>
                            <Row>
                                <Field label="Date of filing" type="date" value={fields.date_filing} onChange={set('date_filing')} />
                                <Field label="Salary" value={fields.salary} onChange={set('salary')} />
                            </Row>
                        </Section>

                        <Section title="6.A — Type of leave">
                            <CheckGrid options={LEAVE_TYPES} ticks={ticks} toggle={toggle} />
                        </Section>

                        <Section title="6.B — Details of leave">
                            <CheckGrid options={LEAVE_DETAILS} ticks={ticks} toggle={toggle} />
                            <div className="mt-4">
                                <Row>
                                    <Field label="If within the Philippines, specify" value={fields.within_ph} onChange={set('within_ph')} />
                                    <Field label="If abroad, specify" value={fields.abroad} onChange={set('abroad')} />
                                </Row>
                                <Row>
                                    <Field label="If in hospital, specify illness" value={fields.in_hospital} onChange={set('in_hospital')} />
                                    <Field label="If out patient, specify illness" value={fields.out_patient} onChange={set('out_patient')} />
                                </Row>
                                <Row>
                                    <Field
                                        label="If special leave benefits for women, specify illness"
                                        value={fields.women_illness}
                                        onChange={set('women_illness')}
                                    />
                                </Row>
                            </div>
                        </Section>

                        <Section title="6.C & 6.D — Days and commutation">
                            <Row>
                                <Field label="Number of working days applied for" placeholder="1 DAY" value={fields.working_days} onChange={set('working_days')} />
                                <Field label="Inclusive dates" placeholder="AUGUST 12, 2026" value={fields.inclusive_dates} onChange={set('inclusive_dates')} />
                            </Row>
                            <CheckGrid
                                options={[['not_requested', 'Commutation not requested'], ['requested', 'Commutation requested']]}
                                ticks={ticks}
                                toggle={toggle}
                            />
                        </Section>

                        <Section title="7.A & 7.B — Credits and recommendation">
                            <Row>
                                <Field label="Credits as of" value={fields.credits_as_of} onChange={set('credits_as_of')} />
                                <Field label="VL total earned" value={fields.vl_earned} onChange={set('vl_earned')} />
                                <Field label="SL total earned" value={fields.sl_earned} onChange={set('sl_earned')} />
                            </Row>
                            <Row>
                                <Field label="VL less this application" value={fields.vl_less} onChange={set('vl_less')} />
                                <Field label="SL less this application" value={fields.sl_less} onChange={set('sl_less')} />
                            </Row>
                            <Row>
                                <Field label="VL balance" value={fields.vl_balance} onChange={set('vl_balance')} />
                                <Field label="SL balance" value={fields.sl_balance} onChange={set('sl_balance')} />
                            </Row>
                            <Row>
                                <Field label="Days with pay" value={fields.days_with_pay} onChange={set('days_with_pay')} />
                                <Field label="Days without pay" value={fields.days_without_pay} onChange={set('days_without_pay')} />
                                <Field label="Others" value={fields.days_others} onChange={set('days_others')} />
                            </Row>
                            <CheckGrid
                                options={[['approval', 'For approval'], ['disapproval', 'For disapproval']]}
                                ticks={ticks}
                                toggle={toggle}
                            />
                        </Section>

                        <div className="mt-8 flex items-center gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={generate}
                                disabled={!canGenerate}
                                className="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                            >
                                Generate leave form
                            </button>
                            {!canGenerate && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    Enter a first and last name to continue.
                                </span>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

/* ---------- small presentational helpers ---------- */

function Section({ title, children }) {
    return (
        <section className="mb-8">
            <h3 className="mb-4 border-b border-gray-200 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {title}
            </h3>
            {children}
        </section>
    );
}

function Row({ children }) {
    return <div className="mb-4 flex flex-wrap gap-4">{children}</div>;
}

function Field({ label, type = 'text', value, onChange, placeholder, required }) {
    return (
        <label className="min-w-[180px] flex-1 block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
                {required && <span className="text-red-500"> *</span>}
            </span>
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
            />
        </label>
    );
}

function CheckGrid({ options, ticks, toggle }) {
    return (
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {options.map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-start gap-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300">
                    <input
                        type="checkbox"
                        checked={ticks.includes(key)}
                        onChange={() => toggle(key)}
                        className="mt-0.5 rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900"
                    />
                    <span>{label}</span>
                </label>
            ))}
        </div>
    );
}
