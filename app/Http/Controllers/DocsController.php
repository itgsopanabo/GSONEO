<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\ViteManifestNotFoundException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use League\CommonMark\Extension\HeadingPermalink\HeadingPermalinkExtension;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Shows the project documentation from docs/ inside the app.
 *
 * The files stay the source of truth: edit docs/DOCUMENTATION.md, and
 * regenerate docs/erd with `php artisan erd:generate`.
 */
class DocsController extends Controller
{
    /** Markdown files shown as tabs, in order: key => [tab label, path under docs/]. */
    private const DOCUMENTS = [
        'docs' => ['Documentation', 'DOCUMENTATION.md'],
        'deployment' => ['Deployment', 'DEPLOYMENT.md'],
    ];

    public function index(): Response
    {
        $erd = base_path('docs/erd/erd.html');

        $documents = collect(self::DOCUMENTS)->map(function (array $doc, string $key) {
            [$label, $file] = $doc;
            $path = base_path('docs/'.$file);
            $exists = File::exists($path);

            return [
                'key' => $key,
                'label' => $label,
                'source' => 'docs/'.$file,
                'html' => $exists ? $this->render(File::get($path)) : null,
                'updatedAt' => $exists ? Carbon::createFromTimestamp(File::lastModified($path))->toIso8601String() : null,
            ];
        })->values();

        return Inertia::render('Docs/Index', [
            'documents' => $documents,
            'erd' => [
                'available' => File::exists($erd),
                'generatedAt' => File::exists($erd) ? Carbon::createFromTimestamp(File::lastModified($erd))->toIso8601String() : null,
                // Relative, so the frame stays on whatever host the user browsed to and keeps their session.
                'url' => route('docs.erd', absolute: false),
            ],
        ]);
    }

    /**
     * Mermaid for the ERD viewer, from the app's own build instead of a CDN, so the
     * diagram also opens where the server and the user's device have no internet.
     *
     * The viewer is a generated file and can't resolve the build's hashed filename
     * itself, so it imports this stable address and lands on the current asset.
     */
    public function erdMermaid(): RedirectResponse
    {
        try {
            $url = Vite::asset('resources/js/erd-mermaid.js');

            // Reduced to a path, so the module loads from whatever host the user browsed
            // to rather than from APP_URL — unless the dev server is serving the assets,
            // which lives on its own origin.
            return redirect(Vite::isRunningHot() ? $url : (parse_url($url, PHP_URL_PATH) ?: $url));
        } catch (ViteManifestNotFoundException) {
            abort(404, 'The frontend assets have not been built yet. Run: npm run build');
        }
    }

    /** The generated standalone ERD viewer, shown in a frame on the Docs page. */
    public function erd(): BinaryFileResponse
    {
        $path = base_path('docs/erd/erd.html');

        abort_unless(File::exists($path), 404, 'The ERD has not been generated yet. Run: php artisan erd:generate');

        return response()->file($path, ['Content-Type' => 'text/html; charset=utf-8']);
    }

    private function render(string $markdown): string
    {
        $html = Str::markdown($markdown, [
            'html_input' => 'strip',
            'allow_unsafe_links' => false,
            // Heading ids match GitHub's, so the document's own table of contents links work.
            'heading_permalink' => [
                'apply_id_to_heading' => true,
                'id_prefix' => '',
                'fragment_prefix' => '',
                'insert' => 'none',
            ],
        ], [new HeadingPermalinkExtension]);

        // Links to other files in the repository (README, .md files) don't exist
        // as app pages, so they are shown as plain text.
        return preg_replace('#<a href="(?!https?://|\#)[^"]*\.md(?:\#[^"]*)?">(.*?)</a>#s', '$1', $html);
    }
}
