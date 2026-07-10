import { excise } from './excise.js';
import { findShallowestElements } from './find-shallowest-elements.js';

/**
 * The six structural regions this module knows how to carve out of a page.
 * Chosen to match both the HTML5 sectioning-element vocabulary and the
 * corresponding ARIA landmark roles, since real sites use either or both
 * (confirmed on two real crawl archives, ~9,200 pages combined: `<header>`/
 * `<footer>`/`<nav>` present on 99%+ of pages; ARIA roles present on ~53% of
 * one of the two sites, layered on top of the tags rather than replacing
 * them).
 *
 * `form` is matched only via `role="form"` (not bare `<form>` tags, which
 * have no implicit landmark role under HTML-AAM unless given an accessible
 * name). `search` is matched via both the `<search>` element (WHATWG
 * landmark shorthand) and `role="search"`.
 */
export type LandmarkType = 'header' | 'footer' | 'nav' | 'aside' | 'form' | 'search';

/**
 * Result of {@link ./extract-landmarks.js | extractLandmarks}. Each landmark
 * field holds the raw HTML of the single chosen instance of that region (see
 * `extractLandmarks`'s JSDoc for the "shallowest wins" selection rule);
 * absent if the page has none — or if the only candidate(s) found were
 * malformed markup `extractLandmarks` declined to trust (see its JSDoc's
 * note on discarded candidates). `remainderHtml` is the original HTML
 * with every chosen region's markup excised, meant to be fed straight into
 * {@link ./tokenize.js | tokenize} as the page's content-only signal.
 */
export type ExtractLandmarksResult = {
	header?: string;
	footer?: string;
	nav?: string;
	aside?: string;
	form?: string;
	search?: string;
	remainderHtml: string;
};

const TAG_TO_TYPE: Readonly<Record<string, LandmarkType>> = {
	header: 'header',
	footer: 'footer',
	nav: 'nav',
	aside: 'aside',
	search: 'search',
};

const ROLE_TO_TYPE: Readonly<Record<string, LandmarkType>> = {
	banner: 'header',
	contentinfo: 'footer',
	navigation: 'nav',
	complementary: 'aside',
	form: 'form',
	search: 'search',
};

/**
 * Determines which landmark type(s) an element matches by tag name or
 * `role`. Deliberately returns every match rather than the first: a
 * `<header role="navigation">` is simultaneously a `header` candidate (by
 * tag) and a `nav` candidate (by role) — both are independently correct
 * answers to "where is this page's header" and "where is this page's nav",
 * so both must be recorded from the same element.
 * @param tagName
 * @param role
 */
function matchLandmarkTypes(tagName: string, role: string | undefined): LandmarkType[] {
	const types: LandmarkType[] = [];
	const byTag = TAG_TO_TYPE[tagName];
	if (byTag) {
		types.push(byTag);
	}
	// role is matched as a single exact literal, same limitation as
	// `create-frame.ts`'s own `attribs.role` handling: no whitespace-
	// separated multi-role splitting, no case normalization.
	const byRole = role ? ROLE_TO_TYPE[role] : undefined;
	if (byRole && !types.includes(byRole)) {
		types.push(byRole);
	}
	return types;
}

/**
 * Finds, for each of the four landmark types, the single best-matching
 * region in `html` (by tag name or ARIA role — see `matchLandmarkTypes`),
 * and returns both that region's own HTML and the rest of the page with all
 * chosen regions removed.
 *
 * When a type has more than one candidate (confirmed on real crawl data: one
 * page had 11 `<header>` elements, most pages have 2-3 `<nav>` elements —
 * typically a site-wide nav plus in-content ones like a "related articles"
 * block), the shallowest one wins (fewest ancestors since `<body>`; ties
 * broken by document order). The rationale: the site-wide chrome instance is
 * structurally the outermost one — anything nested deeper inside `<main>`/
 * `<article>` content is, definitionally, part of the page's own content
 * rather than shared site chrome, even if it happens to reuse the same tag
 * or role.
 *
 * Only the first `<body>` is in scope, matching `tokenize()`'s own contract
 * (`<head>` and anything outside body is ignored; a duplicated top-level
 * `<body>` from broken SSR/templating is ignored, same as
 * `run-tokenizer.ts`).
 *
 * `remainderHtml` is built by excising the chosen regions' raw markup
 * outright — no placeholder is left in their place, since a placeholder
 * string would itself become a token once `remainderHtml` is tokenized,
 * reintroducing exactly the kind of synthetic chrome signal this function
 * exists to remove. One known, accepted side effect of this: if a chosen
 * landmark and the remaining content share a class-less/role-less `<div>`/
 * `<span>` wrapper as siblings, removing the landmark can change that
 * wrapper's child count and flip it from "not fold-eligible" to
 * "fold-eligible" once `remainderHtml` is tokenized (see
 * `resolveClosedFrame`'s fold rule) — the wrapper's own segment then
 * disappears from the surviving paths, shortening them by one level. This
 * is inherent to "delete the matched span, use whatever's left" and is not
 * treated as a bug.
 *
 * A candidate whose closing tag can't be confirmed as genuine (an unclosed
 * or self-closed-with-`/>` landmark tag — see `isGenuineClose`) is discarded
 * rather than trusted: safety against corrupting `remainderHtml` outweighs
 * completeness of landmark detection for malformed markup. That type then
 * falls back to another well-formed candidate of the same type if one
 * exists (regardless of its depth relative to the discarded one), or is
 * left absent if none do — instead of the page's real content being
 * silently deleted.
 * @param html
 * @example
 * ```ts
 * extractLandmarks('<body><header>H</header><main>M</main><footer>F</footer></body>');
 * // {
 * //   header: '<header>H</header>',
 * //   footer: '<footer>F</footer>',
 * //   remainderHtml: '<body><main>M</main></body>',
 * // }
 * ```
 */
export function extractLandmarks(html: string): ExtractLandmarksResult {
	const matches = findShallowestElements(html, matchLandmarkTypes);

	const result: ExtractLandmarksResult = { remainderHtml: html };
	const winnerSpans: { start: number; end: number }[] = [];

	for (const match of matches) {
		result[match.type] = html.slice(match.startOffset, match.endOffset);
		winnerSpans.push({ start: match.startOffset, end: match.endOffset });
	}

	result.remainderHtml = excise(html, winnerSpans);

	return result;
}
