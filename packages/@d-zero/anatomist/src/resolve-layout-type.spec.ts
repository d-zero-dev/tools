import { describe, expect, it } from 'vitest';

import { mockNode } from './__fixtures__/mock-node.js';
import { resolveLayoutType } from './resolve-layout-type.js';

/**
 * @param x
 * @param y
 * @param width
 * @param height
 * @param overrides
 */
function cell(
	x: number,
	y: number,
	width: number,
	height: number,
	overrides: Parameters<typeof mockNode>[0] = {},
) {
	return mockNode({ boundingBox: { x, y, width, height }, ...overrides });
}

const CONTAINER = mockNode({ boundingBox: { x: 0, y: 0, width: 800, height: 600 } });

describe('resolveLayoutType', () => {
	it('resolves table ahead of any geometric check, based on the container itself', () => {
		const container = mockNode({
			tagName: 'TABLE',
			boundingBox: { x: 0, y: 0, width: 800, height: 600 },
		});
		const children = [cell(0, 0, 100, 40)];
		expect(resolveLayoutType(container, children).layoutType).toBe('table');
	});

	it('resolves a uniform multi-row grid as simple-grid', () => {
		const children = [
			cell(0, 0, 100, 100),
			cell(120, 0, 100, 100),
			cell(0, 120, 100, 100),
			cell(120, 120, 100, 100),
		];
		expect(resolveLayoutType(CONTAINER, children).layoutType).toBe('simple-grid');
	});

	it('resolves an uneven multi-row grid as complex-grid', () => {
		const children = [
			cell(0, 0, 100, 100),
			cell(120, 0, 100, 100),
			cell(240, 0, 100, 100),
			cell(0, 120, 100, 100),
		];
		expect(resolveLayoutType(CONTAINER, children).layoutType).toBe('complex-grid');
	});

	it('resolves a single row of children as horizontal-row', () => {
		const children = [cell(0, 0, 100, 40), cell(120, 0, 100, 40), cell(240, 0, 100, 40)];
		expect(resolveLayoutType(CONTAINER, children).layoutType).toBe('horizontal-row');
	});

	it('resolves a floated image overlapping text as float-wrap', () => {
		const image = cell(0, 0, 100, 100, {
			tagName: 'IMG',
			style: {
				display: 'block',
				float: 'left',
				position: 'static',
				visibility: 'visible',
			},
		});
		const paragraph = cell(0, 0, 300, 150, { tagName: 'P' });
		expect(resolveLayoutType(CONTAINER, [image, paragraph]).layoutType).toBe(
			'float-wrap',
		);
	});

	it('resolves stacked single children as vertical-stack', () => {
		const children = [cell(0, 0, 700, 40), cell(0, 60, 700, 40), cell(0, 120, 700, 40)];
		expect(resolveLayoutType(CONTAINER, children).layoutType).toBe('vertical-stack');
	});

	it('falls back to unknown when a child geometry overflows the container (carousel guard)', () => {
		// Children span far beyond the 800px-wide container — simulates a
		// transform-shifted carousel track rather than trustworthy layout.
		const children = [cell(0, 0, 100, 40), cell(2000, 0, 100, 40)];
		const result = resolveLayoutType(CONTAINER, children);
		expect(result.layoutType).toBe('unknown');
		expect(result.confidence).toBe(0);
	});

	it('prioritizes grid over horizontal-row when there are 2+ rows', () => {
		// Ensures the priority order (grid checked before row) actually
		// matters: without it, a naive "any single row" check could never
		// misfire here since detectGridPattern requires 2+ rows anyway, but
		// this asserts the multi-row case never falls through to row/stack.
		const children = [
			cell(0, 0, 100, 100),
			cell(120, 0, 100, 100),
			cell(0, 120, 100, 100),
			cell(120, 120, 100, 100),
		];
		const result = resolveLayoutType(CONTAINER, children);
		expect(result.layoutType).not.toBe('horizontal-row');
		expect(result.layoutType).not.toBe('vertical-stack');
	});

	it('always returns signals, including for unknown', () => {
		const children = [cell(0, 0, 100, 40), cell(2000, 0, 100, 40)];
		const result = resolveLayoutType(CONTAINER, children);
		expect(result.signals).toBeDefined();
	});
});
