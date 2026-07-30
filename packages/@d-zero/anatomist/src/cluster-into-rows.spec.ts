import { describe, expect, it } from 'vitest';

import { clusterIntoRows } from './cluster-into-rows.js';

/**
 * @param x
 * @param y
 * @param width
 * @param height
 */
function box(x: number, y: number, width: number, height: number) {
	return { boundingBox: { x, y, width, height } };
}

describe('clusterIntoRows', () => {
	it('returns an empty array for no items', () => {
		expect(clusterIntoRows([])).toEqual([]);
	});

	it('puts a single item in its own row', () => {
		const a = box(0, 0, 100, 40);
		expect(clusterIntoRows([a])).toEqual([[a]]);
	});

	it('groups items with fully overlapping Y spans into one row', () => {
		const a = box(0, 0, 100, 40);
		const b = box(120, 0, 100, 40);
		const c = box(240, 0, 100, 40);
		expect(clusterIntoRows([a, b, c])).toEqual([[a, b, c]]);
	});

	it('splits items with disjoint Y spans into separate rows', () => {
		const a = box(0, 0, 100, 40);
		const b = box(0, 100, 100, 40);
		expect(clusterIntoRows([a, b])).toEqual([[a], [b]]);
	});

	it('tolerates partial vertical misalignment above the overlap threshold', () => {
		// a spans [0,40], b spans [5,45] -> overlap 35 / shorter span 40 = 0.875
		const a = box(0, 0, 100, 40);
		const b = box(120, 5, 100, 40);
		expect(clusterIntoRows([a, b])).toEqual([[a, b]]);
	});

	it('splits items whose vertical overlap falls below the ratio threshold', () => {
		// a spans [0,40], b spans [35,75] -> overlap 5 / shorter span 40 = 0.125
		const a = box(0, 0, 100, 40);
		const b = box(120, 35, 100, 40);
		expect(clusterIntoRows([a, b])).toEqual([[a], [b]]);
	});

	it('is insensitive to input order (sorts by Y internally)', () => {
		const a = box(0, 0, 100, 40);
		const b = box(0, 100, 100, 40);
		expect(clusterIntoRows([b, a])).toEqual([[a], [b]]);
	});

	it('expands the row window so a later item can join via an accumulated overlap it lacks with the first item alone', () => {
		// a: [0,40]; b: [20,60] overlaps a at ratio 20/40=0.5 -> joins, window becomes [0,60]
		// c: [40,80] has zero overlap with a's original [0,40] span, but overlaps
		// the *expanded* window [0,60] at ratio 20/40=0.5 -> joins only because
		// the window expanded via b.
		const a = box(0, 0, 100, 40);
		const b = box(120, 20, 100, 40);
		const c = box(240, 40, 100, 40);
		expect(clusterIntoRows([a, b, c])).toEqual([[a, b, c]]);
	});

	it('respects a custom overlapRatio threshold', () => {
		const a = box(0, 0, 100, 40);
		const b = box(120, 35, 100, 40); // ratio 0.125
		expect(clusterIntoRows([a, b], 0.1)).toEqual([[a, b]]);
		expect(clusterIntoRows([a, b], 0.5)).toEqual([[a], [b]]);
	});
});
