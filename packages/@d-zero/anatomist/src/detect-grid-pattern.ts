import type { DetectionResult, RawLayoutNode } from './types.js';

import { maxOf } from './max-of.js';

/**
 * @param values
 */
function median(values: readonly number[]): number {
	if (values.length === 0) {
		return 0;
	}
	const sorted = values.toSorted((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * @param values
 */
function coefficientOfVariation(values: readonly number[]): number {
	if (values.length === 0) {
		return 0;
	}
	const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
	if (mean === 0) {
		return 0;
	}
	const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
	return Math.sqrt(variance) / mean;
}

/** Multiple of the typical cell size beyond which a child is treated as spanning more than one cell. */
const SPANNING_RATIO = 1.5;

export type GridDetectionResult = DetectionResult & {
	variant: 'simple' | 'complex' | null;
};

/**
 * Detects a grid pattern (2+ rows of children arranged in columns) from
 * geometry alone, and classifies it as `simple` (uniform row sizes, no
 * cell spans more than one cell) or `complex` (uneven row sizes, or a
 * child spanning multiple cells — the masonry / `grid-template-areas`
 * case). A single row is never a grid — see `detect-horizontal-row-pattern.ts`.
 * @param rows - `children` pre-clustered into rows (see `cluster-into-rows.ts`).
 *   Computed once by `resolve-layout-type.ts` and shared across every
 *   row-based detector rather than re-clustered here, since the geometric
 *   clustering pass is identical work each detector would otherwise repeat.
 * @param children - The same children `rows` was built from, in original order.
 * @example
 * ```ts
 * detectGridPattern(clusterIntoRows(threeByThreeCards), threeByThreeCards);
 * // { matched: true, variant: 'simple', ... }
 * ```
 */
export function detectGridPattern(
	rows: readonly (readonly RawLayoutNode[])[],
	children: readonly RawLayoutNode[],
): GridDetectionResult {
	if (children.length < 2) {
		return {
			matched: false,
			confidence: 0,
			signals: { childCount: children.length },
			variant: null,
		};
	}

	if (rows.length < 2) {
		return {
			matched: false,
			confidence: 0,
			signals: { rowCount: rows.length },
			variant: null,
		};
	}

	const rowSizes = rows.map((row) => row.length);
	// A grid needs at least one row with 2+ columns — every row having
	// exactly one child is N rows of one column each, i.e. a vertical stack
	// (see detect-vertical-stack-pattern.ts), not a grid.
	if (maxOf(rowSizes) < 2) {
		return {
			matched: false,
			confidence: 0,
			signals: { rowCount: rows.length, rowSizes },
			variant: null,
		};
	}

	const uniformRowSize = rowSizes.every((size) => size === rowSizes[0]);

	const widths = children.map((c) => c.boundingBox.width);
	const heights = children.map((c) => c.boundingBox.height);
	const typicalWidth = median(widths);
	const typicalHeight = median(heights);
	const hasSpanning =
		(typicalWidth > 0 &&
			children.some((c) => c.boundingBox.width > typicalWidth * SPANNING_RATIO)) ||
		(typicalHeight > 0 &&
			children.some((c) => c.boundingBox.height > typicalHeight * SPANNING_RATIO));

	const widthCv = coefficientOfVariation(widths);
	const isComplex = !uniformRowSize || hasSpanning;

	return {
		matched: true,
		confidence: isComplex ? 0.6 : 0.85,
		signals: {
			rowCount: rows.length,
			rowSizes,
			widthCv,
			hasSpanning,
			typicalWidth,
			typicalHeight,
		},
		variant: isComplex ? 'complex' : 'simple',
	};
}
