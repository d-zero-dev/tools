import { excise } from './excise.js';
import {
	findMatchingElements,
	type MatchingElement,
} from './find-shallowest-elements.js';
import { buildLineColumnIndex, offsetToLineColumn } from './offset-to-line-column.js';

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
 *
 * `main` is deliberately not a member of this union even though
 * {@link ./extract-landmarks.js | extractLandmarks} reports it: this type is
 * also the parameter type of `resolveLandmarkVariantKeys` and the vocabulary
 * that chrome discovery (`computePerPageLandmarkInstances`'s
 * `ALL_LANDMARK_TYPES`) iterates over. Admitting `'main'` here would let
 * `resolveLandmarkVariantKeys(pages, 'main')` type-check while silently
 * returning nothing (chrome discovery never looks at `main` instances) —
 * exactly the kind of type-level lie this module avoids elsewhere. `main` is
 * content, not chrome: it never participates in frequency-based chrome
 * discovery, only in position reporting.
 */
export type LandmarkType = 'header' | 'footer' | 'nav' | 'aside' | 'form' | 'search';

/**
 * `extractLandmarks`'s internal scanning vocabulary: every public
 * `LandmarkType` plus `'main'`. Kept private to this module so `'main'`
 * never leaks into the public `LandmarkType` union (see its JSDoc).
 */
type InternalLandmarkType = LandmarkType | 'main';

/**
 * An instance's location within the HTML string it was extracted from, in
 * both string-index and 1-based line/column form. Computed once per page by
 * {@link ./extract-landmarks.js | extractLandmarks} via
 * {@link ./offset-to-line-column.js | buildLineColumnIndex}/`offsetToLineColumn`
 * and carried downstream as plain numbers — nothing recomputes it.
 */
export type LandmarkPosition = {
	readonly startOffset: number;
	readonly endOffset: number;
	readonly startLine: number;
	readonly startColumn: number;
	readonly endLine: number;
	readonly endColumn: number;
};

/**
 * One landmark instance: its raw HTML plus its {@link LandmarkPosition}
 * within the page it was extracted from.
 */
export type LandmarkInstance = LandmarkPosition & { readonly html: string };

/**
 * Result of {@link ./extract-landmarks.js | extractLandmarks}. Each landmark
 * field holds an array of every genuinely-closed instance of that region on
 * the page, in document order. Empty array if the page has none — or if
 * every candidate found was malformed markup `extractLandmarks` declined to
 * trust (see its JSDoc's note on discarded candidates). `remainderHtml` is
 * the original HTML with every extracted `header`/`footer`/`nav`/`aside`/
 * `form`/`search` span excised (`main` is never excised — see
 * `extractLandmarks`'s "main handling" note), meant to be fed straight into
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
	header: LandmarkInstance[];
	footer: LandmarkInstance[];
	nav: LandmarkInstance[];
	aside: LandmarkInstance[];
	form: LandmarkInstance[];
	search: LandmarkInstance[];
	main: LandmarkInstance[];
	remainderHtml: string;
};

const TAG_TO_TYPE: Readonly<Record<string, InternalLandmarkType>> = {
	header: 'header',
	footer: 'footer',
	nav: 'nav',
	aside: 'aside',
	search: 'search',
	main: 'main',
};

const ROLE_TO_TYPE: Readonly<Record<string, InternalLandmarkType>> = {
	banner: 'header',
	contentinfo: 'footer',
	navigation: 'nav',
	complementary: 'aside',
	form: 'form',
	search: 'search',
	main: 'main',
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
function matchLandmarkTypes(
	tagName: string,
	role: string | undefined,
): InternalLandmarkType[] {
	const types: InternalLandmarkType[] = [];
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
 * Type guard splitting `findMatchingElements`' combined match list into the
 * excisable six landmark types vs `main`. `main` is content, not chrome, and
 * must never be mixed into the same `keepOutermost` sweep as the other six
 * — see `extractLandmarks`'s "main handling" note for why.
 * @param match
 */
function isMainMatch(
	match: MatchingElement<InternalLandmarkType>,
): match is MatchingElement<'main'> {
	return match.type === 'main';
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
 *
 * ## Main handling
 *
 * `main` (the `<main>` tag or `role="main"`) is collected the same way as
 * the other six types — one entry per genuinely-closed instance, in
 * document order — but is kept out of every mechanism the other six feed:
 *
 * - It is **never excised**: its span is never added to `remainderHtml`'s
 *   excise list, because `main` is the page's actual content, not chrome.
 *   Removing it would gut `remainderHtml` down to whatever sits outside
 *   `<main>` (nothing, on most real pages).
 * - Its `keepOutermost` nesting sweep runs **separately** from the other six
 *   types'. If it shared the sweep, a `<main>` that wraps most of the page
 *   (as it typically does) would make every `header`/`nav`/`aside` nested
 *   inside it look "contained by main" and get dropped — destroying the
 *   section-local chrome detection this module exists to enable (see "Why
 *   collect every instance" above). Only nested `<main>`s (an edge case —
 *   HTML discourages more than one) are deduplicated against each other.
 * - It never contributes to chrome/shell-frequency analysis (`main` is
 *   absent from `computePerPageLandmarkInstances`'s `ALL_LANDMARK_TYPES`):
 *   its instances are reported for position purposes only, never treated as
 *   candidate chrome.
 * @param html
 * @example
 * ```ts
 * extractLandmarks('<body><header>H</header><main>M</main><footer>F</footer></body>');
 * // {
 * //   header: [{ html: '<header>H</header>', startOffset: 6, endOffset: 24,
 * //              startLine: 1, startColumn: 7, endLine: 1, endColumn: 25 }],
 * //   footer: [{ html: '<footer>F</footer>', startOffset: 38, endOffset: 56,
 * //              startLine: 1, startColumn: 39, endLine: 1, endColumn: 57 }],
 * //   nav: [], aside: [], form: [], search: [],
 * //   main: [{ html: '<main>M</main>', startOffset: 24, endOffset: 38,
 * //            startLine: 1, startColumn: 25, endLine: 1, endColumn: 39 }],
 * //   remainderHtml: '<body><main>M</main></body>',
 * // }
 * ```
 */
export function extractLandmarks(html: string): ExtractLandmarksResult {
	const allMatches = findMatchingElements(html, matchLandmarkTypes);
	const mainMatches = allMatches.filter(isMainMatch);
	const excisableMatches = allMatches.filter(
		(match): match is MatchingElement<LandmarkType> => !isMainMatch(match),
	);

	const outermost = keepOutermost(excisableMatches);
	const outermostMain = keepOutermost(mainMatches);

	const result: ExtractLandmarksResult = {
		header: [],
		footer: [],
		nav: [],
		aside: [],
		form: [],
		search: [],
		main: [],
		remainderHtml: html,
	};
	const spans: { start: number; end: number }[] = [];
	const lineColumnIndex = buildLineColumnIndex(html);

	const toInstance = (match: {
		readonly startOffset: number;
		readonly endOffset: number;
	}): LandmarkInstance => {
		const start = offsetToLineColumn(lineColumnIndex, match.startOffset);
		const end = offsetToLineColumn(lineColumnIndex, match.endOffset);
		return {
			html: html.slice(match.startOffset, match.endOffset),
			startOffset: match.startOffset,
			endOffset: match.endOffset,
			startLine: start.line,
			startColumn: start.column,
			endLine: end.line,
			endColumn: end.column,
		};
	};

	for (const match of outermost) {
		result[match.type].push(toInstance(match));
		spans.push({ start: match.startOffset, end: match.endOffset });
	}
	for (const match of outermostMain) {
		result.main.push(toInstance(match));
	}

	result.remainderHtml = excise(html, spans);

	return result;
}
