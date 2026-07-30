import type { DetectionResult, RawLayoutNode } from './types.js';

/**
 * Detects a single-row layout: every child falls into one row cluster
 * (see `cluster-into-rows.ts`). This is a purely visual read — the same
 * shape can come from `display: flex`, `display: grid` with one row, or
 * `inline-block` children; the CSS mechanism is not this detector's
 * concern (see `resolve-layout-type.ts` for how `signals` carries that
 * detail separately).
 * @param rows - `children` pre-clustered into rows. Computed once by
 *   `resolve-layout-type.ts` and shared across every row-based detector.
 * @param childCount - `children.length`, passed separately rather than
 *   re-deriving it from `rows` since a childless call has zero rows either way.
 * @example
 * ```ts
 * detectHorizontalRowPattern(clusterIntoRows(threeCardsSideBySide), 3);
 * // { matched: true, confidence: 0.8, ... }
 * ```
 */
export function detectHorizontalRowPattern(
	rows: readonly (readonly RawLayoutNode[])[],
	childCount: number,
): DetectionResult {
	if (childCount < 2) {
		return { matched: false, confidence: 0, signals: { childCount } };
	}

	const matched = rows.length === 1;

	return {
		matched,
		confidence: matched ? 0.8 : 0,
		signals: { rowCount: rows.length, childCount },
	};
}
