import type { Frame } from './types.js';

/**
 * Resolves a frame once its element has closed, returning the leaf paths it
 * contributes to its parent (still relative to the parent — the parent
 * prefixes its own segment, if any, the next time *it* closes).
 *
 * Whether a `div`/`span` folds away can only be known once it closes (its
 * final child count isn't settled until then), which is why this resolution
 * happens here rather than eagerly when the element opens — see the module
 * doc on `run-tokenizer.ts` for why a naive "emit on open" SAX pass cannot
 * implement folding at all.
 *
 * An element with nothing in `pendingPaths` (e.g. an empty `<div class="spacer">`,
 * or one with only text/whitespace children) is itself a leaf and returns its
 * own segment; a folded wrapper contributes nothing of its own, passing its
 * children's paths straight through so the wrapper's nesting depth carries no
 * structural information (see the "何を捨てたか" note in `tokenize.ts`).
 *
 * Leaf-ness is judged by `pendingPaths`, not `childElementCount`: a comment
 * (when `includeComments` is on) lands in `pendingPaths` without incrementing
 * `childElementCount` (comments don't count toward fold eligibility either),
 * so an element containing only a comment still has something to prefix and
 * must not be treated as a plain leaf that discards it.
 * @param frame
 */
export function resolveClosedFrame(frame: Frame): string[] {
	if (frame.pendingPaths.length === 0) {
		return [frame.segment];
	}

	if (frame.isFoldCandidate && frame.childElementCount === 1) {
		return frame.pendingPaths;
	}

	return frame.pendingPaths.map((path) => `${frame.segment}>${path}`);
}
