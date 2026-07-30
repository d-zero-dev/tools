import { describe, expect, it } from 'vitest';

import { mockNode } from './__fixtures__/mock-node.js';
import { clusterIntoRows } from './cluster-into-rows.js';
import { detectGridPattern } from './detect-grid-pattern.js';

/**
 * @param x
 * @param y
 * @param width
 * @param height
 */
function cell(x: number, y: number, width: number, height: number) {
	return mockNode({ boundingBox: { x, y, width, height } });
}

/**
 * @param children
 */
function detect(children: ReturnType<typeof cell>[]) {
	return detectGridPattern(clusterIntoRows(children), children);
}

describe('detectGridPattern', () => {
	it('does not match fewer than two children', () => {
		expect(detect([cell(0, 0, 100, 40)])).toMatchObject({
			matched: false,
			variant: null,
		});
	});

	it('does not match a single row (that is horizontal-row territory)', () => {
		const children = [cell(0, 0, 100, 40), cell(120, 0, 100, 40), cell(240, 0, 100, 40)];
		expect(detect(children)).toMatchObject({ matched: false, variant: null });
	});

	it('matches a uniform 3x2 grid as simple', () => {
		const children = [
			cell(0, 0, 100, 100),
			cell(120, 0, 100, 100),
			cell(240, 0, 100, 100),
			cell(0, 120, 100, 100),
			cell(120, 120, 100, 100),
			cell(240, 120, 100, 100),
		];
		const result = detect(children);
		expect(result.matched).toBe(true);
		expect(result.variant).toBe('simple');
		expect(result.confidence).toBeGreaterThan(0.8);
	});

	it('classifies uneven row sizes (masonry-like) as complex', () => {
		const children = [
			cell(0, 0, 100, 100),
			cell(120, 0, 100, 100),
			cell(240, 0, 100, 100),
			cell(0, 120, 100, 100),
			cell(120, 120, 100, 100),
		];
		const result = detect(children);
		expect(result.matched).toBe(true);
		expect(result.variant).toBe('complex');
	});

	it('classifies a spanning cell (much wider than the typical cell) as complex', () => {
		const children = [
			cell(0, 0, 320, 100), // spans what would be 3 columns
			cell(0, 120, 100, 100),
			cell(120, 120, 100, 100),
			cell(240, 120, 100, 100),
		];
		const result = detect(children);
		expect(result.matched).toBe(true);
		expect(result.variant).toBe('complex');
		expect(result.signals.hasSpanning).toBe(true);
	});

	it('does not match when every row has exactly one child (that is vertical-stack territory)', () => {
		const children = [cell(0, 0, 700, 40), cell(0, 60, 700, 40), cell(0, 120, 700, 40)];
		expect(detect(children)).toMatchObject({ matched: false, variant: null });
	});
});
