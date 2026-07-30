import { describe, expect, it } from 'vitest';

import { mockNode } from './__fixtures__/mock-node.js';
import { decideRecursion } from './should-recurse.js';

/**
 * @param overrides
 */
function bigChild(overrides: Parameters<typeof mockNode>[0] = {}) {
	return mockNode({ boundingBox: { x: 0, y: 0, width: 200, height: 100 }, ...overrides });
}

describe('decideRecursion', () => {
	it('leafs a node with no meaningful children', () => {
		const node = mockNode({ children: [] });
		expect(decideRecursion(node, 0, { maxDepth: 6 })).toEqual({ kind: 'leaf' });
	});

	it('leafs a node whose only children are below the minimum area', () => {
		const node = mockNode({
			children: [mockNode({ boundingBox: { x: 0, y: 0, width: 5, height: 5 } })],
		});
		expect(decideRecursion(node, 0, { maxDepth: 6 })).toEqual({ kind: 'leaf' });
	});

	it('leafs a node whose only children are display:none', () => {
		const node = mockNode({
			children: [
				bigChild({
					style: {
						display: 'none',
						float: 'none',
						position: 'static',
						visibility: 'visible',
					},
				}),
			],
		});
		expect(decideRecursion(node, 0, { maxDepth: 6 })).toEqual({ kind: 'leaf' });
	});

	it('leafs a node whose only children are visibility:hidden', () => {
		const node = mockNode({
			children: [
				bigChild({
					style: {
						display: 'block',
						float: 'none',
						position: 'static',
						visibility: 'hidden',
					},
				}),
			],
		});
		expect(decideRecursion(node, 0, { maxDepth: 6 })).toEqual({ kind: 'leaf' });
	});

	it('collapses a single-wrapper-child node instead of leaf-ing (the critical fix)', () => {
		const onlyChild = bigChild({ id: 'inner' });
		const node = mockNode({ children: [onlyChild] });
		const decision = decideRecursion(node, 0, { maxDepth: 6 });
		expect(decision).toEqual({ kind: 'collapse', child: onlyChild });
	});

	it('classifies when there are two or more meaningful children', () => {
		const a = bigChild({ boundingBox: { x: 0, y: 0, width: 100, height: 100 } });
		const b = bigChild({ boundingBox: { x: 120, y: 0, width: 100, height: 100 } });
		const node = mockNode({ children: [a, b] });
		const decision = decideRecursion(node, 0, { maxDepth: 6 });
		expect(decision).toEqual({ kind: 'classify', children: [a, b] });
	});

	it('promotes display:contents children transparently, flattening to their children', () => {
		const grandchildA = bigChild({
			id: 'ga',
			boundingBox: { x: 0, y: 0, width: 100, height: 100 },
		});
		const grandchildB = bigChild({
			id: 'gb',
			boundingBox: { x: 120, y: 0, width: 100, height: 100 },
		});
		const contentsWrapper = mockNode({
			style: {
				display: 'contents',
				float: 'none',
				position: 'static',
				visibility: 'visible',
			},
			children: [grandchildA, grandchildB],
		});
		const node = mockNode({ children: [contentsWrapper] });
		const decision = decideRecursion(node, 0, { maxDepth: 6 });
		expect(decision).toEqual({ kind: 'classify', children: [grandchildA, grandchildB] });
	});

	it('leafs when a majority of meaningful children are inline-level (prose flow, not layout)', () => {
		const inlineA = bigChild({
			tagName: 'A',
			style: {
				display: 'inline',
				float: 'none',
				position: 'static',
				visibility: 'visible',
			},
		});
		const inlineB = bigChild({
			tagName: 'A',
			style: {
				display: 'inline',
				float: 'none',
				position: 'static',
				visibility: 'visible',
			},
		});
		const block = bigChild({ tagName: 'SPAN' });
		const node = mockNode({ children: [inlineA, inlineB, block] });
		expect(decideRecursion(node, 0, { maxDepth: 6 })).toEqual({ kind: 'leaf' });
	});

	it('leafs once depth reaches maxDepth even with multiple meaningful children', () => {
		const a = bigChild({ boundingBox: { x: 0, y: 0, width: 100, height: 100 } });
		const b = bigChild({ boundingBox: { x: 120, y: 0, width: 100, height: 100 } });
		const node = mockNode({ children: [a, b] });
		expect(decideRecursion(node, 6, { maxDepth: 6 })).toEqual({ kind: 'leaf' });
	});

	it('respects a custom minArea', () => {
		const node = mockNode({
			children: [mockNode({ boundingBox: { x: 0, y: 0, width: 10, height: 10 } })],
		});
		// area 100 < default 800 -> leaf, but with minArea 50 it should collapse.
		expect(decideRecursion(node, 0, { maxDepth: 6 }).kind).toBe('leaf');
		expect(decideRecursion(node, 0, { maxDepth: 6, minArea: 50 }).kind).toBe('collapse');
	});
});
