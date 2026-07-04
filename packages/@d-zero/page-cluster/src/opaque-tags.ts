import type { OpaqueTagName } from './types.js';

/**
 * Tags whose contents are opaque to structural analysis: `<script>`/`<style>`
 * content is parsed as raw text by htmlparser2 (no `onopentag`/`onclosetag`
 * fires inside them at all), so only `<svg>`/`<noscript>` actually need
 * active self-nesting suppression in callers that track it — kept as a set
 * of four for symmetry rather than because all four need the same handling.
 * Shared by `run-tokenizer.ts` and `extract-landmarks.ts` so a future fix to
 * this list (or to the self-nesting handling built on top of it) can't
 * silently diverge between the two.
 */
export const OPAQUE_TAGS = new Set<OpaqueTagName>(['script', 'style', 'noscript', 'svg']);

/**
 *
 * @param name
 */
export function isOpaqueTagName(name: string): name is OpaqueTagName {
	return OPAQUE_TAGS.has(name as OpaqueTagName);
}
