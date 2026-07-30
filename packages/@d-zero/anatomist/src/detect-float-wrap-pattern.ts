import type { BoundingBox, DetectionResult, RawLayoutNode } from './types.js';

/** Tags treated as "media" for float-wrap detection — text wrapping around a floated image/figure. */
const FLOATED_MEDIA_TAGS: ReadonlySet<string> = new Set(['IMG', 'FIGURE', 'PICTURE']);

/**
 * @param a
 * @param b
 */
function horizontallyOverlaps(a: BoundingBox, b: BoundingBox): boolean {
	return a.x < b.x + b.width && b.x < a.x + a.width;
}

/**
 * @param a
 * @param b
 */
function verticallyOverlaps(a: BoundingBox, b: BoundingBox): boolean {
	return a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Detects a floated-media-with-text-wrap pattern: a floated image-like
 * child (`float !== 'none'`) whose box overlaps another child's box both
 * horizontally and vertically — the geometric signature of text flowing
 * around a float, since non-floated siblings would otherwise stack below
 * it with no overlap.
 *
 * `float` is used as the first-order signal here — unlike every other
 * detector in this package, where geometry decides and CSS only
 * corroborates — because float only affects layout in normal flow: a
 * flex/grid item with `float` set is unaffected by it, so this detector
 * should only ever fire for non-flex/grid parents, which
 * `resolve-layout-type.ts`'s ordering (grid/row detectors run first)
 * already guarantees.
 * @param children - The container's visible, in-flow children.
 * @example
 * ```ts
 * detectFloatWrapPattern([floatedThumbnail, wrappingParagraph]);
 * // { matched: true, confidence: 0.75, ... }
 * ```
 */
export function detectFloatWrapPattern(
	children: readonly RawLayoutNode[],
): DetectionResult {
	const floatedMedia = children.filter(
		(c) => c.style.float !== 'none' && FLOATED_MEDIA_TAGS.has(c.tagName),
	);
	if (floatedMedia.length === 0) {
		return { matched: false, confidence: 0, signals: { floatedMediaCount: 0 } };
	}

	const others = children.filter((c) => !floatedMedia.includes(c));
	const hasWrap = floatedMedia.some((media) =>
		others.some(
			(other) =>
				horizontallyOverlaps(media.boundingBox, other.boundingBox) &&
				verticallyOverlaps(media.boundingBox, other.boundingBox),
		),
	);

	return {
		matched: hasWrap,
		confidence: hasWrap ? 0.75 : 0,
		signals: { floatedMediaCount: floatedMedia.length, hasWrap },
	};
}
