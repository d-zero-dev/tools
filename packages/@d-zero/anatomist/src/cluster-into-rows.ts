import type { BoundingBox } from './types.js';

/** Anything with a box to cluster by position. */
export type WithBoundingBox = { boundingBox: BoundingBox };

/**
 * Groups items into visual rows by greedily merging items whose vertical
 * (Y-axis) span overlaps the current row's accumulated span by at least
 * `overlapRatio`.
 *
 * WHY overlap ratio, not shared Y coordinate: real layouts rarely align
 * every item in a row to the same top edge (baseline alignment, differing
 * heights, icon + label pairs). Requiring a minimum overlap fraction of
 * the shorter item's height tolerates that variance while still splitting
 * clearly-separate rows.
 *
 * A row's span expands (union) as members are added, so a tall first item
 * doesn't prematurely reject a shorter item that only overlaps the tail of
 * its span — the row's window is what accumulates, not the first item's
 * span alone.
 * @param items - Items sorted internally by Y position; caller's order
 *   determines only the caller's expectations of stability, not correctness.
 * @param overlapRatio - Minimum required Y-overlap, as a fraction of the
 *   shorter of the two spans being compared. Default `0.5`.
 * @returns Rows, each in ascending-Y-then-caller order; the input order
 *   within a row is not otherwise significant.
 * @example
 * ```ts
 * clusterIntoRows([
 *   { boundingBox: { x: 0, y: 0, width: 100, height: 40 } },
 *   { boundingBox: { x: 120, y: 5, width: 100, height: 40 } },
 *   { boundingBox: { x: 0, y: 60, width: 100, height: 40 } },
 * ]);
 * // [[item0, item1], [item2]]
 * ```
 */
export function clusterIntoRows<T extends WithBoundingBox>(
	items: readonly T[],
	overlapRatio = 0.5,
): T[][] {
	if (items.length === 0) {
		return [];
	}

	const sorted = items.toSorted((a, b) => a.boundingBox.y - b.boundingBox.y);
	const rows: T[][] = [];

	let currentRow: T[] = [sorted[0]!];
	let rowTop = sorted[0]!.boundingBox.y;
	let rowBottom = rowTop + sorted[0]!.boundingBox.height;

	for (let i = 1; i < sorted.length; i++) {
		const item = sorted[i]!;
		const itemTop = item.boundingBox.y;
		const itemBottom = itemTop + item.boundingBox.height;

		const overlap = Math.max(
			0,
			Math.min(rowBottom, itemBottom) - Math.max(rowTop, itemTop),
		);
		const shorterSpan = Math.min(rowBottom - rowTop, itemBottom - itemTop);
		const ratio = shorterSpan > 0 ? overlap / shorterSpan : 0;

		if (ratio >= overlapRatio) {
			currentRow.push(item);
			rowTop = Math.min(rowTop, itemTop);
			rowBottom = Math.max(rowBottom, itemBottom);
		} else {
			rows.push(currentRow);
			currentRow = [item];
			rowTop = itemTop;
			rowBottom = itemBottom;
		}
	}
	rows.push(currentRow);

	return rows;
}
