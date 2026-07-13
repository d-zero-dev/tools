import { Parser } from 'htmlparser2';

import { isGenuineClose } from './is-genuine-close.js';
import { isOpaqueTagName } from './opaque-tags.js';

/**
 * One genuinely-closed match for type `T`, carrying the depth used for
 * shallowest-wins selection and the element's whole-element and inner-content
 * spans. `depth` is 0 for `<body>` itself, 1 for a direct child, and so on.
 *
 * Returned by {@link ./find-shallowest-elements.js | findMatchingElements},
 * which is the "collect every candidate" primitive shared by every landmark-
 * scanning use site. Callers that want a single winner per type consume the
 * matches through {@link ./find-shallowest-elements.js | findShallowestElements}
 * (which drops `depth` since it's an internal selection artifact once the
 * shallowest has been chosen).
 */
export type MatchingElement<T extends string> = {
	type: T;
	depth: number;
	startOffset: number;
	endOffset: number;
	contentStart: number;
	contentEnd: number;
};

/**
 * One winning element for type `T`: the shallowest (fewest ancestors since
 * `<body>`) genuinely-closed match, ties broken by document order. Both the
 * whole-element span (`startOffset`/`endOffset`) and the inner-content span
 * (`contentStart`/`contentEnd`, excluding the element's own opening/closing
 * tags) are always computed — {@link ./cap-content-depth.js | capContentDepth}
 * only needs the latter, and computing both is cheap enough (two
 * `indexOf`/`lastIndexOf` calls) that carrying the unused half costs nothing
 * a caller need worry about.
 */
export type ShallowestElementMatch<T extends string> = {
	type: T;
	startOffset: number;
	endOffset: number;
	contentStart: number;
	contentEnd: number;
};

type Frame<T extends string> = {
	tagName: string;
	matchedTypes: readonly T[];
	startOffset: number;
};

/**
 * The shared HTML walk behind every landmark-scanning use site: collects
 * every genuinely-closed match for every requested type, without picking a
 * winner. {@link ./find-shallowest-elements.js | findShallowestElements}
 * layers shallowest-per-type selection on top of this; extractLandmarks
 * consumes the full list so downstream data-driven frequency filters can
 * decide which matches are chrome vs content instead of a hard-coded depth
 * rule making that call up here.
 *
 * Only the first `<body>` is in scope, and nothing inside an opaque tag
 * (`script`/`style`/`noscript`/`svg`) is searched — see
 * `extractLandmarks`/`capContentDepth`'s own JSDoc for why.
 *
 * Results are sorted by `startOffset` ascending (document order of the
 * opening tag), which is what extractLandmarks needs both for document-order
 * concatenation and for the outer-before-inner sweep used to filter out
 * nested landmarks so they aren't double-counted in shell tokens.
 * @param html
 * @param matchTypes Given an element's tag name and `role` attribute (already
 * normalized: an empty/absent `role` arrives as `undefined`), returns every
 * type `T` that element matches. Returning more than one lets a single
 * element (e.g. `<header role="navigation">`) match more than one type at
 * once.
 */
export function findMatchingElements<T extends string>(
	html: string,
	matchTypes: (tagName: string, role: string | undefined) => readonly T[],
): MatchingElement<T>[] {
	const stack: Frame<T>[] = [];
	const matches: MatchingElement<T>[] = [];
	let opaque: { tagName: string; depth: number } | null = null;
	let bodyDone = false;
	let ignoredBodyOpens = 0;

	const parser = new Parser(
		{
			onopentag(name, attribs) {
				if (opaque) {
					if (name === opaque.tagName) opaque.depth++;
					return;
				}
				if (stack.length === 0) {
					if (name === 'body' && !bodyDone) {
						stack.push({
							tagName: name,
							matchedTypes: matchTypes(name, attribs.role || undefined),
							startOffset: parser.startIndex,
						});
					}
					return;
				}
				if (name === 'body') {
					ignoredBodyOpens++;
					return;
				}
				if (isOpaqueTagName(name)) {
					opaque = { tagName: name, depth: 1 };
					return;
				}
				stack.push({
					tagName: name,
					matchedTypes: matchTypes(name, attribs.role || undefined),
					startOffset: parser.startIndex,
				});
			},
			onclosetag(name) {
				if (opaque) {
					if (name === opaque.tagName) {
						opaque.depth--;
						if (opaque.depth === 0) opaque = null;
					}
					return;
				}
				if (name === 'body' && ignoredBodyOpens > 0) {
					ignoredBodyOpens--;
					return;
				}
				if (stack.length === 0) return;
				const frame = stack.pop();
				if (!frame) return;
				const depth = stack.length;
				const endOffset = parser.endIndex + 1;
				if (
					frame.matchedTypes.length > 0 &&
					isGenuineClose(html, endOffset, frame.tagName)
				) {
					const contentStart = html.indexOf('>', frame.startOffset) + 1;
					const contentEnd = html.lastIndexOf('<', endOffset - 1);
					for (const type of frame.matchedTypes) {
						matches.push({
							type,
							depth,
							startOffset: frame.startOffset,
							endOffset,
							contentStart,
							contentEnd,
						});
					}
				}
				if (stack.length === 0) bodyDone = true;
			},
		},
		{ decodeEntities: false },
	);
	parser.end(html);

	// Close-tag order is post-order (inner before outer); flip to
	// startOffset-ascending so callers get document-order-of-opening.
	matches.sort((a, b) => a.startOffset - b.startOffset);
	return matches;
}

/**
 * Picks the single shallowest (fewest ancestors since `<body>`) match per
 * type from {@link ./find-shallowest-elements.js | findMatchingElements},
 * ties broken by document order. Used by
 * {@link ./cap-content-depth.js | capContentDepth} to locate the one `<main>`
 * element per page (HTML spec discourages multiple `<main>`s, so shallowest-
 * wins is semantically correct for that use).
 *
 * `depth` is dropped from the returned shape because it's an internal
 * selection artifact that no consumer of the winner needs.
 * @param html
 * @param matchTypes
 */
export function findShallowestElements<T extends string>(
	html: string,
	matchTypes: (tagName: string, role: string | undefined) => readonly T[],
): ShallowestElementMatch<T>[] {
	const matches = findMatchingElements(html, matchTypes);
	const winners = new Map<T, MatchingElement<T>>();
	for (const match of matches) {
		const current = winners.get(match.type);
		if (
			current === undefined ||
			match.depth < current.depth ||
			(match.depth === current.depth && match.startOffset < current.startOffset)
		) {
			winners.set(match.type, match);
		}
	}
	return [...winners.values()].map(
		({ type, startOffset, endOffset, contentStart, contentEnd }) => ({
			type,
			startOffset,
			endOffset,
			contentStart,
			contentEnd,
		}),
	);
}
