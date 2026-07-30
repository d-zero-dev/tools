import type { DetectionResult, RawLayoutNode } from './types.js';

/**
 * Detects a stacked layout: every row cluster (see `cluster-into-rows.ts`)
 * contains exactly one child, i.e. children are stacked one per row with
 * no two sharing a row. This is the fallback-shaped pattern (matches a
 * lone child too), so `resolve-layout-type.ts` checks it last among the
 * geometric detectors.
 * @param rows - `children` pre-clustered into rows. Computed once by
 *   `resolve-layout-type.ts` and shared across every row-based detector.
 * @param childCount - `children.length`, passed separately rather than
 *   re-deriving it from `rows` for symmetry with the other row-based detectors.
 * @example
 * ```ts
 * detectVerticalStackPattern(clusterIntoRows(threeParagraphsStacked), 3);
 * // { matched: true, confidence: 0.8, ... }
 * ```
 */
export function detectVerticalStackPattern(
	rows: readonly (readonly RawLayoutNode[])[],
	childCount: number,
): DetectionResult {
	if (childCount === 0) {
		return { matched: false, confidence: 0, signals: { childCount: 0 } };
	}

	const matched = rows.every((row) => row.length === 1);

	return {
		matched,
		confidence: matched ? 0.8 : 0,
		signals: { rowCount: rows.length, childCount },
	};
}
