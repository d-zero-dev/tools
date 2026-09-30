import type { ContentRoot } from './types.js';

/**
 * Content-root candidates tried, in this priority order, for a page whose
 * caller supplied no {@link ContentRoot} hint and that has no
 * `<main>`/`role="main"` element. The order is the same list a crawler
 * (`@d-zero/beholder`) walks when it detects a page's main-content region —
 * `#main`, `.main`, `#content`, `.content`, `#contents`, `.contents`,
 * `#main-content`, `.main-content`, `#main_content`, `.main_content`,
 * `#mainContent`, `.mainContent` — so that a page clustered without the
 * crawler's hint resolves to the same element the crawler would have
 * reported. `<main>` and `role="main"` come before all of these and are
 * handled by {@link ./cap-content-depth.js | capContentDepth} itself.
 *
 * Only exact `id`/class matches: the crawler's last-resort partial-match
 * stage (`[id*="main"]`, `[class*="content"]`, …) is deliberately not
 * mirrored. It exists to find *some* region for reporting; here a wrong
 * guess silently caps the wrong subtree (a listing frame or an ad slot), and
 * no corpus has validated it.
 */
export const FALLBACK_CONTENT_ROOTS: readonly ContentRoot[] = [
	{ id: 'main' },
	{ classList: ['main'] },
	{ id: 'content' },
	{ classList: ['content'] },
	{ id: 'contents' },
	{ classList: ['contents'] },
	{ id: 'main-content' },
	{ classList: ['main-content'] },
	{ id: 'main_content' },
	{ classList: ['main_content'] },
	{ id: 'mainContent' },
	{ classList: ['mainContent'] },
];
