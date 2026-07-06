import { Parser } from 'htmlparser2';

import { excise } from './excise.js';
import { isGenuineClose } from './is-genuine-close.js';
import { isOpaqueTagName } from './opaque-tags.js';

/**
 * @see removeContentBlocks
 */
export type RemoveContentBlocksOptions = {
	/**
	 * The HTML attribute name that marks one instance of a freeform,
	 * block-editor-authored content region (e.g. a WYSIWYG CMS's own
	 * per-block marker attribute). No default: unlike
	 * {@link ./extract-landmarks.js | extractLandmarks}'s tag names and ARIA
	 * roles, there is no cross-site standard for this — every CMS/page
	 * builder invents its own convention, so the caller must name theirs.
	 */
	blockAttribute: string;
};

/**
 * Result of {@link ./remove-content-blocks.js | removeContentBlocks}.
 */
export type RemoveContentBlocksResult = {
	remainderHtml: string;
};

type Frame = {
	tagName: string;
	hasBlockAttribute: boolean;
	startOffset: number;
};

/**
 * Removes every element in `html` carrying `options.blockAttribute`,
 * including its full subtree, and returns what's left.
 *
 * Built for a specific real-crawl finding: two pages built from the same
 * article template, but authored with a different mix of freeform CMS
 * content blocks (e.g. one page uses a "wysiwyg" block then two "image"
 * blocks, another uses a "title" block then one "image" block), tokenize to
 * almost entirely disjoint leaf paths — each block's own internal markup
 * differs, and that difference dominates the page's whole token set. This
 * defeats {@link ./resolve-structural-cluster-keys.js |
 * resolveStructuralClusterKeys}'s frequency-based chrome/content split
 * (`deriveComparisonSets`), which only recognizes tokens common to *nearly
 * every* page in a block as chrome; a block-editor region varies too much
 * page-to-page to ever clear that bar, yet contributes no genuine
 * template-identifying signal either. Confirmed on a real corpus (302
 * pages): removing these regions before tokenizing cut structural-cluster
 * count from 192 to 32 (with {@link ./extract-landmarks.js | extractLandmarks}
 * and blocking-key fixes already applied) — the single largest lever found
 * for that corpus.
 *
 * Unlike `extractLandmarks`, every matching element is removed (there is no
 * "one instance per type" — a page can have any number of content blocks),
 * and matching is by a single caller-supplied attribute rather than a fixed
 * tag/role vocabulary — see `RemoveContentBlocksOptions.blockAttribute`'s
 * JSDoc for why. `remainderHtml` drops each matched region's markup
 * entirely (no placeholder), for the same reason `extractLandmarks` does:
 * a placeholder string would itself become a token once tokenized.
 *
 * Only the first `<body>` is in scope and opaque tags
 * (`script`/`style`/`svg`/`noscript`) are not searched inside, matching
 * `extractLandmarks`'s and `tokenize()`'s own contracts. A candidate whose
 * closing tag can't be confirmed as genuine (see `isGenuineClose`) is
 * discarded rather than trusted, for the same safety reason `extractLandmarks`
 * discards one.
 * @param html
 * @param options
 * @example
 * ```ts
 * removeContentBlocks(
 * 	'<body><main><div data-bgb="wysiwyg">free text</div><div data-bgb="image1">...</div></main></body>',
 * 	{ blockAttribute: 'data-bgb' },
 * );
 * // { remainderHtml: '<body><main></main></body>' }
 * ```
 */
export function removeContentBlocks(
	html: string,
	options: RemoveContentBlocksOptions,
): RemoveContentBlocksResult {
	const { blockAttribute } = options;
	const stack: Frame[] = [];
	const spans: { start: number; end: number }[] = [];
	// Same rationale and shape as extractLandmarks's own `opaque` tracking:
	// a different opaque tag opening/closing while already inside one must
	// not perturb this counter. Also tracks whether the opaque tag itself
	// (its own attributes, not any descendant's) carries `blockAttribute` —
	// an opaque tag can be a content block's own root (e.g. an inline `<svg>`
	// chart authored as one block), and diving into its children to look for
	// the attribute would be pointless (they're never searched for landmarks
	// or blocks either) but the opaque root itself must still be checked.
	let opaque: {
		tagName: string;
		depth: number;
		matched: boolean;
		startOffset: number;
	} | null = null;
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
						// The whole page can never itself be "a content block" —
						// unlike extractLandmarks's ARIA-role matching (a
						// standardized vocabulary under which `<body role="banner">`
						// is a legitimate whole-page landmark), `blockAttribute` is
						// an arbitrary caller-chosen name that could collide with an
						// unrelated attribute a CMS/theme happens to stamp onto
						// `<body>` (a page-type marker, a `body_class()`-style hook).
						// Treating that as a match would silently empty the page's
						// entire remainderHtml.
						stack.push({
							tagName: name,
							hasBlockAttribute: false,
							startOffset: parser.startIndex,
						});
					}
					// Ignore everything else outside <body>, same as
					// extractLandmarks/run-tokenizer.ts.
					return;
				}

				if (name === 'body') {
					ignoredBodyOpens++;
					return;
				}

				if (isOpaqueTagName(name)) {
					opaque = {
						tagName: name,
						depth: 1,
						matched: attribs[blockAttribute] !== undefined,
						startOffset: parser.startIndex,
					};
					return;
				}

				stack.push({
					tagName: name,
					hasBlockAttribute: attribs[blockAttribute] !== undefined,
					startOffset: parser.startIndex,
				});
			},
			onclosetag(name) {
				if (opaque) {
					if (name === opaque.tagName) {
						opaque.depth--;
						if (opaque.depth === 0) {
							const endOffset = parser.endIndex + 1;
							if (opaque.matched && isGenuineClose(html, endOffset, opaque.tagName)) {
								spans.push({ start: opaque.startOffset, end: endOffset });
							}
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
				const endOffset = parser.endIndex + 1;
				if (frame.hasBlockAttribute && isGenuineClose(html, endOffset, frame.tagName)) {
					spans.push({ start: frame.startOffset, end: endOffset });
				}
				if (stack.length === 0) {
					bodyDone = true;
				}
			},
		},
		{ decodeEntities: false },
	);
	parser.end(html);

	return { remainderHtml: excise(html, spans) };
}
