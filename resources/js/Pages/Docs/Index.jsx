import { useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDateTime } from '@/Utils/formatDate.js';
import useMermaidDiagrams from '@/Utils/useMermaidDiagrams.js';

export default function Index({ documents = [], erd }) {
    const tabs = [...documents.map((d) => ({ key: d.key, label: d.label })), { key: 'erd', label: 'ERD' }];

    // The tab lives in the address (#deployment, #erd) so refreshes and shared links open the same view.
    const readTab = () => {
        const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
        return tabs.some((t) => t.key === hash) ? hash : tabs[0].key;
    };
    const [tab, setTab] = useState(readTab);

    const choose = (key) => {
        setTab(key);
        window.history.replaceState(null, '', key === tabs[0].key ? window.location.pathname : `#${key}`);
    };

    const doc = documents.find((d) => d.key === tab);

    // Draws the ```mermaid fences in the markdown as diagrams once the HTML is on the page.
    const content = useRef(null);
    useMermaidDiagrams(content, doc?.key);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">Docs</h2>
                    <div role="tablist" aria-label="Documentation views" className="inline-flex flex-wrap rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
                        {tabs.map((t) => (
                            <button
                                key={t.key}
                                type="button"
                                role="tab"
                                aria-selected={tab === t.key}
                                onClick={() => choose(t.key)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                    tab === t.key
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            }
        >
            <Head title="Docs" />

            {doc ? (
                <div className="py-8">
                    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                        {doc.html ? (
                            <article className="bg-white px-6 py-8 shadow-sm dark:bg-gray-800 sm:rounded-lg sm:px-10">
                                <p className="mb-6 text-xs text-gray-500 dark:text-gray-400">
                                    Last updated {formatDateTime(doc.updatedAt)} · source: <code>{doc.source}</code>
                                </p>
                                {/* Rendered server-side from trusted docs files, with raw HTML stripped. */}
                                <div ref={content} className="doc-content" dangerouslySetInnerHTML={{ __html: doc.html }} />
                            </article>
                        ) : (
                            <p className="rounded-lg bg-white p-8 text-center text-sm text-gray-500 shadow-sm dark:bg-gray-800">
                                <code>{doc.source}</code> was not found.
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex h-[calc(100vh-7.5rem)] flex-col p-4 sm:p-6">
                    {erd.available ? (
                        <>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span>
                                    Generated {formatDateTime(erd.generatedAt)}. After a migration, run{' '}
                                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-200">php artisan erd:generate</code>{' '}
                                    to refresh it.
                                </span>
                                <a href={erd.url} target="_blank" rel="noopener" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                                    Open full screen ↗
                                </a>
                            </div>
                            <iframe
                                src={erd.url}
                                title="Entity relationship diagram"
                                className="w-full flex-1 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700"
                            />
                        </>
                    ) : (
                        <div className="rounded-lg bg-white p-8 text-center shadow-sm dark:bg-gray-800">
                            <p className="font-medium text-gray-800 dark:text-gray-200">The ERD hasn't been generated yet.</p>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                Run <code>docker compose exec app php artisan erd:generate</code>, then reload this page.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </AuthenticatedLayout>
    );
}
