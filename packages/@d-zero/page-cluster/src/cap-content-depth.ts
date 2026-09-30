import type { ContentRoot } from './types.js';

import { Parser } from 'htmlparser2';

import { FALLBACK_CONTENT_ROOTS } from './content-root-fallbacks.js';
import { excise } from './excise.js';
import { findShallowestElements } from './find-shallowest-elements.js';
import { isGenuineClose } from './is-genuine-close.js';
import { matchesContentRoot } from './matches-content-root.js';
import { isOpaqueTagName } from './opaque-tags.js';

/**
 * The only landmark this function knows how to depth-cap by name. A closed
 * union (not an open `string`) because, unlike
 * {@link ./remove-content-blocks.js | removeContentBlocks}'s caller-supplied
 * CMS attribute, `<main>`/`role="main"` is an HTML5/ARIA standard — there is
 * exactly one vocabulary to support, not one per site. Sites that mark their
 * content root some other way are handled by
 * {@link CapContentDepthOptions.contentRoot} and the built-in fallback list,
 * not by widening this union.
 */
export type ContentDepthLandmark = 'main';

/**
 * @see capContentDepth
 */
export type CapContentDepthOptions = {
	/** Defaults to `'main'`, the only value. */
	landmark?: ContentDepthLandmark;
	/**
	 * The page's own content root, as a crawler recorded it. When it matches
	 * an element of the (static) HTML it wins over `<main>`/`role="main"` and
	 * the built-in fallbacks; when it matches nothing (the crawler measured
	 * the rendered DOM, so an id or class added by client-side script is
	 * absent here) resolution silently continues with the fallbacks rather
	 * than leaving the page uncapped. See {@link ./cap-content-depth.js |
	 * capContentDepth} for the full resolution order.
	 */
	contentRoot?: ContentRoot;
	/**
	 * How many levels of elements *inside* the landmark to keep, counting the
	 * landmark's own direct children as depth 1. Must be a non-negative
	 * integer (0 keeps none of the landmark's content, only its own opening/
	 * closing tags). See {@link ./cap-content-depth.js | capContentDepth}'s
	 * JSDoc for how to choose this.
	 */
	maxDepth: number;
};

/**
 * Result of {@link ./cap-content-depth.js | capContentDepth}.
 */
export type CapContentDepthResult = {
	remainderHtml: string;
};

const TAG_TO_LANDMARK: Readonly<Record<string, ContentDepthLandmark>> = { main: 'main' };
const ROLE_TO_LANDMARK: Readonly<Record<string, ContentDepthLandmark>> = { main: 'main' };

const HINT_TYPE = 'hint';
const LANDMARK_TYPE = 'landmark';
const FALLBACK_TYPES = FALLBACK_CONTENT_ROOTS.map((_, index) => `fallback:${index}`);

/**
 * Resolution order of the content root, most specific first: the caller's
 * `contentRoot` hint, then `<main>`/`role="main"`, then the built-in
 * fallback list ({@link ./content-root-fallbacks.js | FALLBACK_CONTENT_ROOTS}).
 * The first kind that has any genuine match on the page decides, and within
 * that kind the shallowest match wins.
 */
const PRIORITY: readonly string[] = [HINT_TYPE, LANDMARK_TYPE, ...FALLBACK_TYPES];

/**
 * Finds the element the depth cap counts inside — see {@link PRIORITY} for
 * the order — via {@link ./find-shallowest-elements.js | findShallowestElements}
 * (same "shallowest wins" rule as {@link ./extract-landmarks.js |
 * extractLandmarks} uses for its own landmark types, for the same reason: the
 * site-wide, outermost instance is the real one), and returns the offsets of
 * its content (excluding its own opening/closing tags) — or `undefined` if
 * there is no genuine one.
 *
 * All kinds are matched in one walk of the page and the priority applied
 * afterwards, rather than one walk per kind: the depth sweep in
 * {@link ./detect-content-depth-cap.js | detectContentDepthCap} calls this
 * once per page per candidate depth, so the number of parses matters.
 * @param html
 * @param landmark
 * @param contentRoot
 */
function findShallowestLandmarkContent(
	html: string,
	landmark: ContentDepthLandmark,
	contentRoot: ContentRoot | undefined,
): { contentStart: number; contentEnd: number } | undefined {
	const winners = findShallowestElements(html, (name, role, attribs) => {
		const types: string[] = [];
		if (contentRoot && matchesContentRoot(contentRoot, name, attribs)) {
			types.push(HINT_TYPE);
		}
		if (
			TAG_TO_LANDMARK[name] === landmark ||
			(role !== undefined && ROLE_TO_LANDMARK[role] === landmark)
		) {
			types.push(LANDMARK_TYPE);
		}
		for (const [index, fallback] of FALLBACK_CONTENT_ROOTS.entries()) {
			if (matchesContentRoot(fallback, name, attribs)) {
				types.push(FALLBACK_TYPES[index]!);
			}
		}
		return types;
	});
	for (const type of PRIORITY) {
		const winner = winners.find((candidate) => candidate.type === type);
		if (winner) {
			return { contentStart: winner.contentStart, contentEnd: winner.contentEnd };
		}
	}
	return undefined;
}

type DeepFrame = {
	tagName: string;
	startOffset: number;
};

/**
 * Within `html.slice(contentStart, contentEnd)`, finds every element whose
 * nesting depth (the landmark's own direct children are depth 1) exceeds
 * `maxDepth`, and returns their `[start, end)` spans (absolute offsets into
 * the original `html`) for excision. Once a too-deep element is found, its
 * subtree is not explored further — same reasoning as
 * {@link ./remove-content-blocks.js | removeContentBlocks} not diving into
 * an already-matched block: nothing inside a span already marked for
 * removal needs its own depth checked.
 * @param html
 * @param contentStart
 * @param contentEnd
 * @param maxDepth
 */
function collectDeepSpans(
	html: string,
	contentStart: number,
	contentEnd: number,
	maxDepth: number,
): { start: number; end: number }[] {
	const spans: { start: number; end: number }[] = [];
	const stack: DeepFrame[] = [];
	let opaque: { tagName: string; depth: number } | null = null;
	// Set once a too-deep element opens; cleared when that same element
	// closes. While set, every nested open/close (other than matching
	// closes of the capped tag itself) is ignored, same shape as the
	// `opaque` tracking above.
	let cappedAt: { tagName: string; depth: number } | null = null;

	const parser = new Parser(
		{
			onopentag(name) {
				if (opaque) {
					if (name === opaque.tagName) opaque.depth++;
					return;
				}
				if (cappedAt) {
					if (name === cappedAt.tagName) cappedAt.depth++;
					return;
				}
				if (isOpaqueTagName(name)) {
					opaque = { tagName: name, depth: 1 };
					return;
				}
				const depth = stack.length + 1;
				if (depth > maxDepth) {
					cappedAt = { tagName: name, depth: 1 };
					spans.push({ start: contentStart + parser.startIndex, end: -1 });
					return;
				}
				stack.push({ tagName: name, startOffset: parser.startIndex });
			},
			onclosetag(name) {
				if (opaque) {
					if (name === opaque.tagName) {
						opaque.depth--;
						if (opaque.depth === 0) opaque = null;
					}
					return;
				}
				if (cappedAt) {
					if (name === cappedAt.tagName) {
						cappedAt.depth--;
						if (cappedAt.depth === 0) {
							const endOffset = contentStart + parser.endIndex + 1;
							const open = spans.at(-1);
							if (open) {
								open.end = isGenuineClose(html, endOffset, name) ? endOffset : open.start;
							}
							cappedAt = null;
						}
					}
					return;
				}
				const frame = stack.pop();
				if (!frame) return;
			},
		},
		{ decodeEntities: false },
	);
	parser.end(html.slice(contentStart, contentEnd));

	// A capped span whose genuine close was never confirmed (malformed
	// markup) collapses to a zero-length span at its own start — excise()
	// treats start === end as a no-op slice, so nothing is corrupted, and
	// that one candidate is simply not removed, the same safety trade-off
	// extractLandmarks/removeContentBlocks make for unclosed tags.
	return spans.filter((span) => span.end > span.start);
}

/**
 * Excises the deepest content inside the page's content root, keeping up to
 * `options.maxDepth` levels of nesting and returning what's left.
 *
 * The content root is, in priority order: `options.contentRoot` (what the
 * caller measured for this page), the shallowest `<main>`/`role="main"`, then
 * the first hit of the built-in fallback list
 * ({@link ./content-root-fallbacks.js | FALLBACK_CONTENT_ROOTS}: `#main`,
 * `.main`, `#content`, …). Each kind that matches decides on its own; a
 * hint that matches nothing in the static HTML falls through to the next
 * kind. Falling through, rather than leaving the page uncapped, is
 * deliberate: a crawler records the hint from the rendered DOM, and an id or
 * class added by client-side script is absent from the stored HTML.
 *
 * Built for the same real-crawl finding {@link ./remove-content-blocks.js |
 * removeContentBlocks} addresses — freeform CMS-block content dominating a
 * page's token set and defeating structural similarity — but without
 * needing the caller to know their CMS's own block-marker attribute.
 * `<main>` is HTML5-standard, so the common case needs no per-site
 * configuration (sites without it use `contentRoot` or the built-in
 * fallbacks). Confirmed on two unrelated real crawls with `<main>` (302 and
 * ~4,100 pages): once nesting depth inside `<main>` passes a threshold
 * (3, on both), the number of distinct structural clusters explodes (14x
 * and 9x, respectively) — the "skeleton" (which template a page uses) lives
 * in the shallow levels; the free-edited content that varies page-to-page
 * lives deeper. See {@link ./detect-content-depth-cap.js |
 * detectContentDepthCap} to find that threshold automatically instead of
 * hardcoding `maxDepth`.
 *
 * The content root's own opening/closing tags (and their attributes, e.g. a
 * class that itself differs between a list-page and a detail-page `<main>`)
 * are always kept — only what's *between* them past `maxDepth` is excised,
 * for the same reason `extractLandmarks` never adds a placeholder: the tag
 * itself is real structural signal, not something to erase.
 *
 * A page with no content root under any of the above has nothing to cap;
 * `remainderHtml` is returned unchanged, matching this package's convention
 * for "nothing to do" (see `extractLandmarks`, `removeContentBlocks`).
 * @param html
 * @param options
 * @example
 * ```ts
 * capContentDepth(
 * 	'<body><main><div><div><div><div>too deep</div></div></div></div></main></body>',
 * 	{ landmark: 'main', maxDepth: 2 },
 * );
 * // { remainderHtml: '<body><main><div><div></div></div></main></body>' }
 *
 * // No <main>: anchor on the element a crawler reported as the content root.
 * capContentDepth(
 * 	'<body><div id="main"><div><div><p>too deep</p></div></div></div></body>',
 * 	{ contentRoot: { tagName: 'div', id: 'main' }, maxDepth: 2 },
 * );
 * // { remainderHtml: '<body><div id="main"><div><div></div></div></div></body>' }
 * ```
 */
export function capContentDepth(
	html: string,
	options: CapContentDepthOptions,
): CapContentDepthResult {
	if (!(Number.isInteger(options.maxDepth) && options.maxDepth >= 0)) {
		throw new RangeError(
			`capContentDepth: maxDepth must be a non-negative integer, got ${options.maxDepth}`,
		);
	}

	const content = findShallowestLandmarkContent(
		html,
		options.landmark ?? 'main',
		options.contentRoot,
	);
	if (!content) {
		return { remainderHtml: html };
	}

	const spans = collectDeepSpans(
		html,
		content.contentStart,
		content.contentEnd,
		options.maxDepth,
	);
	return { remainderHtml: excise(html, spans) };
}
