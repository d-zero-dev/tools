import { Parser } from 'htmlparser2';

import { excise } from './excise.js';
import { findShallowestElements } from './find-shallowest-elements.js';
import { isGenuineClose } from './is-genuine-close.js';
import { isOpaqueTagName } from './opaque-tags.js';

/**
 * The only landmark this function knows how to depth-cap. A closed union
 * (not an open `string`) because, unlike
 * {@link ./remove-content-blocks.js | removeContentBlocks}'s caller-supplied
 * CMS attribute, `<main>`/`role="main"` is an HTML5/ARIA standard — there is
 * exactly one vocabulary to support, not one per site.
 */
export type ContentDepthLandmark = 'main';

/**
 * @see capContentDepth
 */
export type CapContentDepthOptions = {
	landmark: ContentDepthLandmark;
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

/**
 * Finds the single shallowest `<main>`/`role="main"` element in `html` via
 * {@link ./find-shallowest-elements.js | findShallowestElements} (same
 * "shallowest wins" rule as {@link ./extract-landmarks.js | extractLandmarks}
 * uses for its own four landmark types, for the same reason: the site-wide,
 * outermost instance is the real one), and returns the offsets of its
 * content (excluding its own opening/closing tags) — or `undefined` if there
 * is no genuine one.
 * @param html
 * @param landmark
 */
function findShallowestLandmarkContent(
	html: string,
	landmark: ContentDepthLandmark,
): { contentStart: number; contentEnd: number } | undefined {
	const [winner] = findShallowestElements(html, (name, role) =>
		TAG_TO_LANDMARK[name] === landmark ||
		(role !== undefined && ROLE_TO_LANDMARK[role] === landmark)
			? [landmark]
			: [],
	);
	return winner
		? { contentStart: winner.contentStart, contentEnd: winner.contentEnd }
		: undefined;
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
 * Excises the deepest content inside `options.landmark` (currently only
 * `'main'`/`role="main"` is supported — see `ContentDepthLandmark`'s JSDoc),
 * keeping up to `options.maxDepth` levels of nesting and returning what's
 * left.
 *
 * Built for the same real-crawl finding {@link ./remove-content-blocks.js |
 * removeContentBlocks} addresses — freeform CMS-block content dominating a
 * page's token set and defeating structural similarity — but without
 * needing the caller to know their CMS's own block-marker attribute.
 * `<main>` is HTML5-standard, so this works without any per-site
 * configuration at all. Confirmed on two unrelated real crawls (302 and
 * ~4,100 pages): once nesting depth inside `<main>` passes a threshold
 * (3, on both), the number of distinct structural clusters explodes (14x
 * and 9x, respectively) — the "skeleton" (which template a page uses) lives
 * in the shallow levels; the free-edited content that varies page-to-page
 * lives deeper. See {@link ./detect-content-depth-cap.js |
 * detectContentDepthCap} to find that threshold automatically instead of
 * hardcoding `maxDepth`.
 *
 * `<main>`'s own opening/closing tags (and their attributes, e.g. a class
 * that itself differs between a list-page and a detail-page `<main>`) are
 * always kept — only what's *between* them past `maxDepth` is excised, for
 * the same reason `extractLandmarks` never adds a placeholder: the tag
 * itself is real structural signal, not something to erase.
 *
 * A page with no `<main>` and no `role="main"` element has nothing to cap;
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

	const content = findShallowestLandmarkContent(html, options.landmark);
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
