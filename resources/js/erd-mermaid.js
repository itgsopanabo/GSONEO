import mermaid from 'mermaid';

/**
 * Mermaid, as a build entry of its own, for the ERD viewer.
 *
 * The viewer (resources/views/erd/viewer.blade.php) is rendered to a standalone
 * HTML file by `php artisan erd:generate` and served by DocsController@erd, so it
 * can't use @vite to resolve the hashed filename. It imports this entry through
 * the stable /docs/erd/mermaid.js address instead, which redirects to whatever
 * the current build produced.
 *
 * Keeping Mermaid in the bundle rather than on a CDN is what lets the ERD open on
 * a server and on user devices with no route to the public internet.
 *
 * It is handed over on `window` because Vite builds application entries for their
 * side effects and strips their exports, so an `export` here would not survive the
 * build. The viewer is a page of its own, so the global belongs to nothing else.
 */
window.mermaid = mermaid;
