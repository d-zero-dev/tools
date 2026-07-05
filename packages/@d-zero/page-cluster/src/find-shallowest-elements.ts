import { Parser } from 'htmlparser2';

import { isGenuineClose } from './is-genuine-close.js';
import { isOpaqueTagName } from './opaque-tags.js';

/**
 * One winning element for type `T`: the shallowest (fewest ancestors since
 * `<body>`) genuinely-closed match, ties broken by document order. Both the
 * whole-element span (`startOffset`/`endOffset`) and the inner-content span
 * (`contentStart`/`contentEnd`, excluding the element's own opening/closing
 * tags) are always computed — {@link ./extract-landmarks.js | extractLandmarks}
 * only needs the former, {@link ./cap-content-depth.js | capContentDepth}
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

type Candidate<T extends string> = {
	type: T;
	depth: number;
	startOffset: number;
	endOffset: number;
	contentStart: number;
	contentEnd: number;
};

/**
 * Shared walk behind {@link ./extract-landmarks.js | extractLandmarks} (which
 * matches four landmark types per element in one pass) and
 * {@link ./cap-content-depth.js | capContentDepth} (which matches a single
 * landmark). Both need the identical "shallowest genuinely-closed match
 * wins" search — same `<body>`-scoping, same opaque-tag skip, same malformed-
 * markup discard via {@link ./is-genuine-close.js | isGenuineClose} — so a
 * fix to one (e.g. the body-scoping edge case already fixed once in
 * `extractLandmarks`) can't silently fail to apply to the other.
 *
 * Only the first `<body>` is in scope, and nothing inside an opaque tag
 * (`script`/`style`/`noscript`/`svg`) is searched — see
 * `extractLandmarks`/`capContentDepth`'s own JSDoc for why.
 * @param html
 * @param matchTypes Given an element's tag name and `role` attribute (already
 * normalized: an empty/absent `role` arrives as `undefined`), returns every
 * type `T` that element matches. Returning more than one lets a single
 * element (e.g. `<header role="navigation">`) win more than one type at
 * once.
 */
export function findShallowestElements<T extends string>(
	html: string,
	matchTypes: (tagName: string, role: string | undefined) => readonly T[],
): ShallowestElementMatch<T>[] {
	const stack: Frame<T>[] = [];
	const candidates: Candidate<T>[] = [];
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
						candidates.push({
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

	const winners = new Map<T, Candidate<T>>();
	for (const candidate of candidates) {
		const current = winners.get(candidate.type);
		if (
			current === undefined ||
			candidate.depth < current.depth ||
			(candidate.depth === current.depth && candidate.startOffset < current.startOffset)
		) {
			winners.set(candidate.type, candidate);
		}
	}
	// `depth` (Candidate's own tie-break field) is deliberately not part of
	// ShallowestElementMatch: it's an internal selection detail, not
	// something either caller (extractLandmarks, capContentDepth) uses once
	// the winner is chosen.
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
