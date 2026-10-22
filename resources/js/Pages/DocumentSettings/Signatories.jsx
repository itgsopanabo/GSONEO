import { Head, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DocumentSettingsTabs from '@/Components/DocumentSettingsTabs';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

const field =
    'w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ' +
    'dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:focus:border-indigo-500';

/** documents -> { doc: { slot: { name, position } } }, the shape the server validates. */
const toForm = (documents) =>
    Object.fromEntries(
        Object.entries(documents).map(([doc, { slots }]) => [
            doc,
            Object.fromEntries(Object.entries(slots).map(([slot, s]) => [slot, { name: s.name, position: s.position }])),
        ]),
    );

/** How the block prints: the name over a signing line, the position beneath. */
function SignaturePreview({ name, position }) {
    return (
        <div className="w-full text-center" aria-hidden="true">
            <div className="min-h-[1.25rem] truncate border-b border-gray-800 pb-0.5 text-xs font-bold uppercase text-gray-900 dark:border-gray-300 dark:text-gray-100">
                {name || ' '}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">{position || ' '}</div>
        </div>
    );
}

export default function Signatories({ documents }) {
    const { data, setData, put, processing, errors, isDirty, reset, setDefaults } = useForm({
        signatories: toForm(documents),
    });

    const setSlot = (doc, slot, key, value) =>
        setData('signatories', {
            ...data.signatories,
            [doc]: { ...data.signatories[doc], [slot]: { ...data.signatories[doc][slot], [key]: value } },
        });

    const submit = (e) => {
        e.preventDefault();
        put(route('document-settings.signatories.update'), {
            preserveScroll: true,
            onSuccess: () => setDefaults(),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    Document branding
                </h2>
            }
        >
            <Head title="Signatories" />

            <form onSubmit={submit} className="py-8">
                <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <DocumentSettingsTabs />

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        The names and positions printed in each document&apos;s signature blocks. Type names the way
                        they should print, with titles and suffixes. Leave a name empty to print a blank line for
                        signing by hand. Changes apply to documents generated after you save.
                    </p>

                    {Object.entries(documents).map(([doc, { label, slots }]) => (
                        <section
                            key={doc}
                            className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
                        >
                            <h3 className="border-b border-gray-100 px-6 py-3 text-base font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
                                {label}
                            </h3>

                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {Object.entries(slots).map(([slot, { label: slotLabel }]) => {
                                    const value = data.signatories[doc][slot];
                                    const id = `${doc}-${slot}`;
                                    const nameError = errors[`signatories.${doc}.${slot}.name`];
                                    const positionError = errors[`signatories.${doc}.${slot}.position`];

                                    return (
                                        <div key={slot} className="grid gap-4 px-6 py-4 md:grid-cols-[1fr_1fr_12rem] md:items-start">
                                            <div>
                                                <label htmlFor={`${id}-name`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    {slotLabel} <span className="font-normal text-gray-400">· name</span>
                                                </label>
                                                <input
                                                    id={`${id}-name`}
                                                    type="text"
                                                    maxLength={120}
                                                    value={value.name}
                                                    placeholder="Blank line to sign on"
                                                    onChange={(e) => setSlot(doc, slot, 'name', e.target.value)}
                                                    className={`${field} mt-1.5`}
                                                />
                                                {nameError && <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{nameError}</p>}
                                            </div>
                                            <div>
                                                <label htmlFor={`${id}-position`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Position
                                                </label>
                                                <input
                                                    id={`${id}-position`}
                                                    type="text"
                                                    maxLength={120}
                                                    value={value.position}
                                                    onChange={(e) => setSlot(doc, slot, 'position', e.target.value)}
                                                    className={`${field} mt-1.5`}
                                                />
                                                {positionError && <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{positionError}</p>}
                                            </div>
                                            <div className="hidden pt-7 md:block">
                                                <SignaturePreview name={value.name} position={value.position} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}

                    <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 bg-gray-100/95 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:mx-0 sm:rounded-b-lg">
                        {isDirty && (
                            <span className="mr-auto text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>
                        )}
                        <SecondaryButton onClick={() => reset()} disabled={processing || !isDirty}>
                            Discard
                        </SecondaryButton>
                        <PrimaryButton type="submit" disabled={processing || !isDirty}>
                            {processing ? 'Saving…' : 'Save signatories'}
                        </PrimaryButton>
                    </div>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
