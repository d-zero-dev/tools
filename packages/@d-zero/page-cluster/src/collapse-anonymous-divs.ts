import { FOLDABLE_TAGS } from './foldable-tags.js';

/**
 * Only `FOLDABLE_TAGS` qualify — those are the tags `build-segment.ts` omits
 * the name from when they have classes (producing `.c-x` instead of `div.c-x`),
 * so a bare `div` or `span` with NO class is a structural-only wrapper.
 * Non-foldable tags (`section`, `article`, …) always appear with their tag name
 * and carry semantic meaning even when classless, so they are kept.
 * @param segment
 */
function isAnonymousSegment(segment: string): boolean {
	return FOLDABLE_TAGS.has(segment);
}

/**
 * Removes bare foldable-tag segments (e.g. plain `div`, `span`) from the
 * interior of a path token, leaving the first and last segments untouched.
 * Used before containment-assignment union construction so that two clusters
 * whose paths differ only in intermediate anonymous wrapper `<div>`s are not
 * spuriously separated.
 *
 * Intermediate bare `div`/`span` elements are anonymous wrappers with no
 * class, role, or type — they carry no structural meaning beyond "something
 * was nested here", and their presence varies freely across CMS themes and
 * minor template revisions. Stripping them from the middle of a path keeps
 * the union comparison focused on the meaningful skeleton (semantic tags,
 * class-bearing wrappers, bracketed roles).
 *
 * First and last segments are always preserved: the first segment anchors the
 * path in the document tree (`body`, `main`, …) and the last segment is the
 * leaf element being tokenized — both carry meaning even when they are bare
 * foldable tags.
 * @param token A full path token, e.g. `body>main>div>section.c-x>div>.card`.
 */
export function collapseAnonymousDivs(token: string): string {
	const segments = token.split('>');
	if (segments.length <= 2) {
		return token;
	}

	const first = segments[0] ?? '';
	const last = segments.at(-1) ?? '';
	const middle = segments.slice(1, -1).filter((seg) => !isAnonymousSegment(seg));

	return [first, ...middle, last].join('>');
}
