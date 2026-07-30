/**
 * Selector lists for locating a page's main-content region, shared as data
 * so other packages (e.g. `@d-zero/anatomist`) can resolve the same element
 * without duplicating the heuristic.
 *
 * WHY duplicated in `extractMainContentsFromDocument` (`get-main-contents.ts`): that function
 * must stay closure-free so Puppeteer can serialize it into `page.evaluate`
 * (see its module JSDoc). A `page.evaluate`-bound function cannot reference
 * an imported module-level constant — Puppeteer only sends the function's
 * source text across, not its closure — so the arrays there stay inlined.
 * `main-content-selectors.spec.ts` asserts the two lists stay in sync.
 * @module
 */

/**
 * Selectors tried first, in priority order. The caller-supplied selector
 * (when present) is prepended ahead of these by the consumer.
 */
export const MAIN_CONTENT_SELECTORS: readonly string[] = [
	'main',
	'[role="main"]',
	'#main',
	'.main',
	'#content',
	'.content',
	'#contents',
	'.contents',
	'#main-content',
	'.main-content',
	'#main_content',
	'.main_content',
	'#mainContent',
	'.mainContent',
];

/**
 * Fallback selectors tried, in order, only when none of
 * {@link MAIN_CONTENT_SELECTORS} match. The first match that isn't `<body>`
 * or `<html>` wins.
 */
export const MAIN_CONTENT_FALLBACK_SELECTORS: readonly string[] = [
	'[id*="main" i]',
	'[class*="main" i]',
	'[id*="content" i]',
	'[class*="content" i]',
];
