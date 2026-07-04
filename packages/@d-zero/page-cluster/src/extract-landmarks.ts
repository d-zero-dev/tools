import { Parser } from 'htmlparser2';

import { isOpaqueTagName } from './opaque-tags.js';

/**
 * The four structural regions this module knows how to carve out of a page.
 * Chosen to match both the HTML5 sectioning-element vocabulary and the
 * corresponding ARIA landmark roles, since real sites use either or both
 * (confirmed on two real crawl archives, ~9,200 pages combined: `<header>`/
 * `<footer>`/`<nav>` present on 99%+ of pages; ARIA roles present on ~53% of
 * one of the two sites, layered on top of the tags rather than replacing
 * them).
 */
export type LandmarkType = 'header' | 'footer' | 'nav' | 'aside';

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
	remainderHtml: string;
};

const TAG_TO_TYPE: Readonly<Record<string, LandmarkType>> = {
	header: 'header',
	footer: 'footer',
	nav: 'nav',
	aside: 'aside',
};

const ROLE_TO_TYPE: Readonly<Record<string, LandmarkType>> = {
	banner: 'header',
	contentinfo: 'footer',
	navigation: 'nav',
	complementary: 'aside',
};

type Frame = {
	tagName: string;
	matchedTypes: readonly LandmarkType[];
	startOffset: number;
};

type Candidate = {
	type: LandmarkType;
	depth: number;
	startOffset: number;
	endOffset: number;
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
 * Merges a set of (possibly overlapping or nested) `[start, end)` spans into
 * the smallest equivalent set of disjoint spans, sorted by start offset.
 * Landmark spans commonly nest in real markup (a site nav living inside the
 * header, e.g. `<header><nav>...</nav></header>`) — merging first means the
 * later excision pass never has to reason about overlap.
 * @param spans
 */
function mergeSpans(
	spans: readonly { start: number; end: number }[],
): { start: number; end: number }[] {
	const sorted = [...spans].toSorted((a, b) => a.start - b.start);
	const merged: { start: number; end: number }[] = [];
	for (const span of sorted) {
		const last = merged.at(-1);
		if (last && span.start <= last.end) {
			last.end = Math.max(last.end, span.end);
		} else {
			merged.push({ ...span });
		}
	}
	return merged;
}

/**
 * Escapes regex metacharacters in `text` so it can be interpolated into a
 * `RegExp` literally. Needed because `tagName` reaching {@link isGenuineClose}
 * is not guaranteed to be a plain HTML tag name: htmlparser2 accepts
 * characters like `(`/`[` inside a tag name (`<div(foo role="banner">`
 * parses with tag name `"div(foo"`), which would otherwise either throw
 * (an unbalanced `(` is an invalid regex) or silently change what the regex
 * matches.
 * @param text
 */
function escapeRegExp(text: string): string {
	return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether `html` actually contains a literal closing tag for `tagName`
 * ending at `endOffset`. htmlparser2 fires `onclosetag` not only for real
 * closing tags but also when it force-closes a still-open ancestor to
 * resolve a mismatch (e.g. `<header>H<main>...</main></body>` with no
 * `</header>` ever written) — and in that forced case it reports the
 * force-closed element's `endIndex` as wherever the *other*, unrelated
 * closing tag that triggered the cascade happens to sit, not any position
 * derived from `<header>` itself (confirmed by direct htmlparser2 event
 * tracing: both the synthetic `header` close and the real `body` close
 * report the identical `endIndex`, because there is no real `</header>` in
 * the source for htmlparser2 to anchor a distinct position to). Trusting
 * that offset would slice a candidate spanning all the way to wherever the
 * unrelated tag ends, silently swallowing real content into
 * `remainderHtml`'s missing half. Checking that the text immediately
 * preceding `endOffset` actually spells the expected closing tag catches
 * exactly this: a genuine close always ends with it; a forced one ends with
 * whatever unrelated tag forced it instead.
 * @param html
 * @param endOffset
 * @param tagName
 */
function isGenuineClose(html: string, endOffset: number, tagName: string): boolean {
	const windowStart = Math.max(0, endOffset - tagName.length - 3);
	return new RegExp(`</\\s*${escapeRegExp(tagName)}\\s*>$`, 'i').test(
		html.slice(windowStart, endOffset),
	);
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
	const stack: Frame[] = [];
	const candidates: Candidate[] = [];
	// Only the *same* tag name nested inside itself (`<svg><svg>...`) counts
	// as self-nesting; a different opaque tag opening/closing while already
	// inside one (e.g. `<svg><script>...</script></svg>`, valid SVG
	// scripting) fires its own open/close events but must not perturb this
	// counter — same rationale and shape as `OpaqueRegion` in
	// `run-tokenizer.ts`.
	let opaque: { tagName: string; depth: number } | null = null;
	let bodyDone = false;
	let ignoredBodyOpens = 0;

	const parser = new Parser(
		{
			onopentag(name, attribs) {
				if (opaque) {
					if (name === opaque.tagName) {
						opaque.depth++;
					}
					return;
				}

				if (stack.length === 0) {
					if (name === 'body' && !bodyDone) {
						// <body role="banner"> is a real (if unusual) way to mark
						// the whole page as its own header landmark; matched the
						// same way any other role-bearing element is, rather than
						// hardcoding matchedTypes to [] as if body could never
						// carry a landmark role itself.
						stack.push({
							tagName: name,
							matchedTypes: matchLandmarkTypes(name, attribs.role || undefined),
							startOffset: parser.startIndex,
						});
					}
					// Ignore everything else outside <body> (head, a second
					// top-level <body>, ...) — same as run-tokenizer.ts.
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
					matchedTypes: matchLandmarkTypes(name, attribs.role || undefined),
					startOffset: parser.startIndex,
				});
			},
			onclosetag(name) {
				if (opaque) {
					if (name === opaque.tagName) {
						opaque.depth--;
						if (opaque.depth === 0) {
							opaque = null;
						}
					}
					return;
				}

				if (name === 'body' && ignoredBodyOpens > 0) {
					ignoredBodyOpens--;
					return;
				}

				if (stack.length === 0) {
					return;
				}

				const frame = stack.pop();
				if (!frame) {
					return;
				}
				const depth = stack.length;
				const endOffset = parser.endIndex + 1;
				// Discard rather than trust a candidate whose close was forced by
				// an unrelated tag (see isGenuineClose) — safety against
				// corrupting remainderHtml outweighs completeness of landmark
				// detection for malformed markup.
				if (
					frame.matchedTypes.length > 0 &&
					isGenuineClose(html, endOffset, frame.tagName)
				) {
					for (const type of frame.matchedTypes) {
						candidates.push({ type, depth, startOffset: frame.startOffset, endOffset });
					}
				}
				if (stack.length === 0) {
					bodyDone = true;
				}
			},
		},
		{ decodeEntities: false },
	);
	parser.end(html);

	const result: ExtractLandmarksResult = { remainderHtml: html };
	const winnerSpans: { start: number; end: number }[] = [];

	for (const type of ['header', 'footer', 'nav', 'aside'] as const) {
		const typeCandidates = candidates.filter((c) => c.type === type);
		if (typeCandidates.length === 0) {
			continue;
		}
		let winner = typeCandidates[0];
		for (const candidate of typeCandidates) {
			if (
				winner === undefined ||
				candidate.depth < winner.depth ||
				(candidate.depth === winner.depth && candidate.startOffset < winner.startOffset)
			) {
				winner = candidate;
			}
		}
		if (!winner) {
			continue;
		}
		result[type] = html.slice(winner.startOffset, winner.endOffset);
		winnerSpans.push({ start: winner.startOffset, end: winner.endOffset });
	}

	if (winnerSpans.length > 0) {
		const merged = mergeSpans(winnerSpans);
		let remainder = '';
		let cursor = 0;
		for (const span of merged) {
			remainder += html.slice(cursor, span.start);
			cursor = span.end;
		}
		remainder += html.slice(cursor);
		result.remainderHtml = remainder;
	}

	return result;
}
