import type { Frame, OpaqueRegion, OpaqueTagName, ResolvedOptions } from './types.js';

import { Parser } from 'htmlparser2';

import { createFrame } from './create-frame.js';
import { formatBracket } from './format-bracket.js';
import { hashContent } from './hash-content.js';
import { resolveClosedFrame } from './resolve-closed-frame.js';

const OPAQUE_TAGS = new Set<OpaqueTagName>(['script', 'style', 'noscript', 'svg']);

/**
 *
 * @param name
 */
function isOpaqueTagName(name: string): name is OpaqueTagName {
	return OPAQUE_TAGS.has(name as OpaqueTagName);
}

/**
 * The innermost open frame. Every call site only reaches this after checking
 * `stack.length > 0`, so the thrown branch is unreachable in practice; it
 * exists to satisfy `noUncheckedIndexedAccess` without a non-null assertion.
 * @param stack
 */
function topOf(stack: readonly Frame[]): Frame {
	const frame = stack.at(-1);
	if (!frame) {
		throw new Error('runTokenizer: expected an open frame on the stack');
	}
	return frame;
}

/**
 * Drives `htmlparser2` over `html` and returns the ordered leaf paths found
 * under the first `<body>`. Anything outside that first `<body>` is ignored
 * (`<head>`, a second top-level `<body>`) — see `tokenize.ts` for why — and so
 * is any stray `<body>` tag nested *inside* the first one's content, a known
 * artifact of broken SSR/templating: browsers create no node for it, so its
 * open/close tags are swallowed while its content still attaches to whatever
 * real element actually contains it.
 *
 * WHY a stack of frames rather than emitting tokens the moment a tag opens:
 * whether a class-less/role-less/type-less `div`/`span` folds away depends
 * on its final child-element count, which is only settled once *it* closes
 * — by which point any leaf inside it has already been visited. Buffering
 * each open ancestor's not-yet-finalized descendant paths
 * (`Frame.pendingPaths`) lets that decision be made retroactively without
 * ever materializing the whole document as a tree: memory stays
 * proportional to nesting depth and pending output, not document size.
 *
 * `htmlparser2`'s `script`/`style` handling never fires `onopentag`/
 * `onclosetag` for content inside those tags (they're parsed as raw text),
 * so only `svg`/`noscript` need active suppression of their nested
 * open/close events; `depth` guards against those two self-nesting
 * (`<svg><svg>...`).
 * @param html
 * @param options
 */
export function runTokenizer(html: string, options: ResolvedOptions): string[] {
	const stack: Frame[] = [];
	let opaque: OpaqueRegion | null = null;
	let bodyDone = false;
	let result: string[] = [];
	// Counts <body> open tags ignored because a body was already open (a
	// stray/duplicated body from broken SSR/templating). Browsers create no
	// node for these, so neither the open nor its matching close tag should
	// touch the frame stack; this counter lets onclosetag recognize and
	// swallow that matching close instead of popping an unrelated frame.
	let ignoredBodyOpens = 0;

	const parser = new Parser({
		onopentag(name, attribs) {
			if (opaque) {
				if (name === opaque.tagName) {
					opaque.depth++;
				}
				return;
			}

			if (stack.length === 0) {
				if (name === 'body' && !bodyDone) {
					stack.push(createFrame(name, attribs, options));
				}
				// Ignore everything else outside <body> (head, a second top-level <html>/<body>, ...).
				return;
			}

			if (name === 'body') {
				ignoredBodyOpens++;
				return;
			}

			topOf(stack).childElementCount++;

			if (isOpaqueTagName(name)) {
				opaque = {
					tagName: name,
					depth: 1,
					contentStart: parser.endIndex + 1,
					role: attribs.role || undefined,
					type: attribs.type || undefined,
				};
				return;
			}

			stack.push(createFrame(name, attribs, options));
		},
		onclosetag(name) {
			if (opaque) {
				if (name === opaque.tagName) {
					opaque.depth--;
					if (opaque.depth === 0) {
						const raw = html.slice(opaque.contentStart, parser.startIndex);
						const bracket = formatBracket({
							role: opaque.role,
							type: opaque.type,
							sha: hashContent(raw),
						});
						topOf(stack).pendingPaths.push(`${name}${bracket}`);
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
				// Closing tag outside <body> (or a second top-level </body>): nothing to do.
				return;
			}

			const frame = stack.pop();
			if (!frame) {
				return;
			}
			const contributed = resolveClosedFrame(frame);

			if (stack.length === 0) {
				result = contributed;
				bodyDone = true;
			} else {
				topOf(stack).pendingPaths.push(...contributed);
			}
		},
		oncomment(data) {
			if (!options.includeComments || opaque || stack.length === 0) {
				return;
			}
			topOf(stack).pendingPaths.push(`comment[sha=${hashContent(data)}]`);
		},
	});

	parser.parseComplete(html);

	return result;
}
