import { excise } from './excise.js';
import {
	findMatchingElements,
	type MatchingElement,
} from './find-shallowest-elements.js';

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
 * field holds an array of the raw HTML of every genuinely-closed instance
 * of that region on the page, in document order. Empty array if the page
 * has none — or if every candidate found was malformed markup
 * `extractLandmarks` declined to trust (see its JSDoc's note on discarded
 * candidates). `remainderHtml` is the original HTML with every extracted
 * span excised, meant to be fed straight into
 * {@link ./tokenize.js | tokenize} as the page's content-only signal.
 *
 * Multiple instances per type are the norm, not the exception: real crawl
 * data commonly has 2–3 `<nav>`s per page (site nav + local nav + related-
 * articles nav), and one production page in the tuning corpora had 11
 * `<header>` elements. Downstream is responsible for deciding which
 * instances are chrome vs content via corpus/unit frequency analysis (see
 * {@link ./merge-cross-block-clusters.js | mergeCrossBlockClusters}'s
 * `shellQuorum`) rather than this module baking that judgment in with a
 * depth or ordering rule.
 */
export type ExtractLandmarksResult = {
	header: string[];
	footer: string[];
	nav: string[];
	aside: string[];
	form: string[];
	search: string[];
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
 * Filters out any match whose whole-element span is strictly contained by
 * another match's span, keeping only outermost instances. Runs across all
 * landmark types together — a `<nav>` nested inside a `<header>` gets
 * dropped, since keeping both would let shell-token computations count the
 * nav's markup twice (once as the header's inner HTML and once as the nav
 * itself), skewing the frequency histograms that downstream chrome
 * detection depends on. Ties (identical spans, e.g. `<header
 * role="navigation">` matching both types) are preserved: neither strictly
 * contains the other.
 *
 * Input is expected pre-sorted by `startOffset` ascending, which is what
 * `findMatchingElements` guarantees. In the worst case the inner scan over
 * already-kept outers is O(n²) — real crawl data has fewer than ~30
 * landmark candidates per page so this is comfortably faster than the
 * alternative approaches (interval tree, span sweep with an active-set
 * stack) at page-scale sizes. If a real corpus with hundreds of landmarks
 * per page ever appears, revisit.
 * @param matches
 */
function keepOutermost<T extends string>(
	matches: readonly MatchingElement<T>[],
): MatchingElement<T>[] {
	const result: MatchingElement<T>[] = [];
	for (const match of matches) {
		let contained = false;
		for (const outer of result) {
			if (
				outer.startOffset <= match.startOffset &&
				match.endOffset <= outer.endOffset &&
				// A strict containment; identical spans (same element matching
				// two types via tag+role) are not dropped.
				(outer.startOffset < match.startOffset || match.endOffset < outer.endOffset)
			) {
				contained = true;
				break;
			}
		}
		if (!contained) result.push(match);
	}
	return result;
}

/**
 * Collects every genuinely-closed landmark instance on the page — one entry
 * per type per instance, in document order — and returns them alongside
 * `remainderHtml`, the original HTML with every extracted span excised.
 *
 * ## Why collect every instance rather than a single "primary" one
 *
 * Earlier iterations of this function returned the shallowest match per
 * type on the theory that the outermost `<nav>`/`<header>`/… was the "real"
 * site-wide chrome and anything deeper was page-specific content. Real
 * crawl data breaks that model on the third category: **section-local
 * chrome**. On a real mid-sized crawl corpus, one URL section carried a
 * section-local `<nav>` inside `<main>` that other sections didn't; with
 * shallowest-wins that nav gets classified as content and left in
 * `remainderHtml`, at which point the corpus-wide 90% frequency filter
 * leaves it there (it's not frequent enough), and the section-local
 * template variant disappears into the same cluster as the section without
 * the local nav.
 *
 * Delegating chrome-vs-content judgment to downstream frequency analysis
 * (see {@link ./merge-cross-block-clusters.js | mergeCrossBlockClusters}'s
 * `shellQuorum`, which runs auto-cut over the per-landmark-token page-
 * frequency histogram) lets the same primitive already used for merge-
 * height cutoffs discover chrome across whatever scope it's applied at —
 * corpus-wide, block-wide, unit-wide — without a hard-coded rule up here
 * forcing the call one way.
 *
 * ## Why single-string concatenation was rejected
 *
 * A weaker variant of "collect every instance" concatenates all matches of
 * the same type into one string and keeps the old single-string result
 * shape. That was evaluated and rejected: it breaks
 * `computeLandmarkStatus`'s `canonicalizeTokenSet` bucketing (article-
 * specific `<header>`s vary per page, exploding buckets toward page count
 * and killing the O(n²) → O(bucket²) speedup), pollutes `shellQuorum` with
 * in-content nav tokens (dismantling the L2 microsite guard), and still
 * conflates site-wide vs local nav instances within the same type token set (the
 * common-vocabulary tokens of a global nav bury the distinctive tokens of
 * a section-local nav in any frequency filter downstream). Array shape
 * with instance-level downstream handling avoids all three.
 *
 * ## Nested landmark handling
 *
 * `<nav>` nested inside a `<header>` is genuinely two landmarks by the
 * HTML/ARIA vocabulary, but for the frequency-analysis use case they're
 * one region of markup and must not be counted twice. `keepOutermost`
 * drops the inner match on those grounds. An identical-span element that
 * matches two types via tag+role (e.g. `<header role="navigation">`) is
 * preserved under both types since neither strictly contains the other.
 *
 * ## Scoping and robustness
 *
 * Only the first `<body>` is in scope, matching `tokenize()`'s own contract
 * (`<head>` and anything outside body is ignored; a duplicated top-level
 * `<body>` from broken SSR/templating is ignored). Nothing inside an opaque
 * tag (`script`/`style`/`noscript`/`svg`) is searched. A candidate whose
 * closing tag can't be confirmed as genuine (an unclosed or self-closed-
 * with-`/>` landmark tag — see `isGenuineClose`) is discarded rather than
 * trusted: safety against corrupting `remainderHtml` outweighs completeness.
 *
 * `remainderHtml` is built by excising the extracted spans' raw markup
 * outright — no placeholder is left in their place, since a placeholder
 * string would itself become a token once `remainderHtml` is tokenized,
 * reintroducing exactly the kind of synthetic chrome signal this function
 * exists to remove. One known, accepted side effect: if an extracted
 * landmark and the remaining content share a class-less/role-less `<div>`/
 * `<span>` wrapper as siblings, removing the landmark can change that
 * wrapper's child count and flip it from "not fold-eligible" to
 * "fold-eligible" once `remainderHtml` is tokenized. The wrapper's own
 * segment then disappears from the surviving paths, shortening them by one
 * level. This is inherent to "delete the matched span, use whatever's
 * left" and is not treated as a bug.
 * @param html
 * @example
 * ```ts
 * extractLandmarks('<body><header>H</header><main>M</main><footer>F</footer></body>');
 * // {
 * //   header: ['<header>H</header>'],
 * //   footer: ['<footer>F</footer>'],
 * //   nav: [], aside: [], form: [], search: [],
 * //   remainderHtml: '<body><main>M</main></body>',
 * // }
 * ```
 */
export function extractLandmarks(html: string): ExtractLandmarksResult {
	const allMatches = findMatchingElements(html, matchLandmarkTypes);
	const outermost = keepOutermost(allMatches);

	const result: ExtractLandmarksResult = {
		header: [],
		footer: [],
		nav: [],
		aside: [],
		form: [],
		search: [],
		remainderHtml: html,
	};
	const spans: { start: number; end: number }[] = [];

	for (const match of outermost) {
		result[match.type].push(html.slice(match.startOffset, match.endOffset));
		spans.push({ start: match.startOffset, end: match.endOffset });
	}

	result.remainderHtml = excise(html, spans);

	return result;
}
