import type { MirrorAxis } from './detect-mirror-axis.js';

/**
 * Reduces a page's URL path to a shape that is stable across a detected
 * {@link MirrorAxis} by replacing the segment at `axis.position` with a
 * fixed placeholder whenever it is one of the axis's known values. Two pages
 * that are mirrors of the same content under different axis values (e.g. the
 * `en` and `zh` copies of the same page) normalize to the same shape; a page
 * whose segment at that position is *not* one of the axis's values (so it
 * isn't part of the mirror at all) is left untouched, since collapsing it
 * too would falsely equate unrelated pages that merely share a path depth.
 * @param paths A page's URL path segments (e.g. `ExURL.paths`).
 * @param axis A `MirrorAxis` from {@link ./detect-mirror-axis.js | detectMirrorAxis}.
 * @example
 * ```ts
 * const axis = { position: 0, values: new Set(['en', 'zh']) };
 * normalizePathByMirrorAxis(['en', 'faq', 'index.html'], axis);
 * // '{axis}/faq/index.html'
 * normalizePathByMirrorAxis(['zh', 'faq', 'index.html'], axis);
 * // '{axis}/faq/index.html' — same shape as the `en` page above
 * ```
 */
export function normalizePathByMirrorAxis(
	paths: readonly string[],
	axis: MirrorAxis,
): string {
	return paths
		.map((segment, i) =>
			i === axis.position && axis.values.has(segment) ? '{axis}' : segment,
		)
		.join('/');
}
