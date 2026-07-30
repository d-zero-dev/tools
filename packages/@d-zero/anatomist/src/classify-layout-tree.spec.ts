import { describe, expect, it } from 'vitest';

import { mockNode } from './__fixtures__/mock-node.js';
import { classifyLayoutTree } from './classify-layout-tree.js';

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

describe('classifyLayoutTree', () => {
	it('renders a childless node as a leaf', () => {
		const root = mockNode({ innerHTML: '<p>hi</p>', children: [] });
		const result = classifyLayoutTree(root);
		expect(result.layoutType).toBe('leaf');
		expect(result.children).toEqual([]);
		expect(result.innerHTML).toBe('<p>hi</p>');
	});

	it('collapses a chain of single-child wrappers before classifying real content', () => {
		const cardA = cell(0, 0, 100, 100, { id: 'card-a' });
		const cardB = cell(120, 0, 100, 100, { id: 'card-b' });
		const inner = mockNode({
			id: 'inner',
			boundingBox: { x: 0, y: 0, width: 220, height: 100 },
			children: [cardA, cardB],
		});
		const wrapper = mockNode({ id: 'wrapper', children: [inner] });
		const root = mockNode({ id: 'root', children: [wrapper] });

		const result = classifyLayoutTree(root);

		// root -> wrapper -> inner are all single-child, so classification
		// should reach `inner`'s two-card row directly, at depth 0.
		expect(result.layoutType).toBe('horizontal-row');
		expect(result.id).toBe('inner');
		expect(result.children).toHaveLength(2);
		expect(result.children[0]?.layoutType).toBe('leaf');
	});

	it('classifies a multi-row grid and recurses into each cell', () => {
		const children = [
			cell(0, 0, 100, 100, { children: [cell(0, 0, 50, 20)] }),
			cell(120, 0, 100, 100, { children: [cell(0, 0, 50, 20)] }),
			cell(0, 120, 100, 100, { children: [cell(0, 0, 50, 20)] }),
			cell(120, 120, 100, 100, { children: [cell(0, 0, 50, 20)] }),
		];
		const root = mockNode({
			boundingBox: { x: 0, y: 0, width: 300, height: 300 },
			children,
		});

		const result = classifyLayoutTree(root);

		expect(result.layoutType).toBe('simple-grid');
		expect(result.children).toHaveLength(4);
		// Each cell has one meaningful child of its own -> collapses into a leaf.
		expect(result.children[0]?.layoutType).toBe('leaf');
	});

	it('leafs out once maxDepth is reached, keeping innerHTML but no children', () => {
		// root (depth 0) has two branches, each with two grandchildren (depth 1).
		const grandchildA1 = cell(0, 0, 50, 50, { innerHTML: 'bottom' });
		const grandchildA2 = cell(60, 0, 50, 50);
		const branchA = mockNode({
			boundingBox: { x: 0, y: 0, width: 100, height: 100 },
			innerHTML: 'branch-a',
			children: [grandchildA1, grandchildA2],
		});
		const branchB = mockNode({ boundingBox: { x: 120, y: 0, width: 100, height: 100 } });
		const root = mockNode({ children: [branchA, branchB] });

		const result = classifyLayoutTree(root, { maxDepth: 1 });

		// depth 0 classifies root's two branches; depth 1 (branchA's children)
		// hits maxDepth and leafs instead of classifying further.
		expect(result.children[0]?.layoutType).toBe('leaf');
		expect(result.children[0]?.innerHTML).toBe('branch-a');
		expect(result.children[0]?.children).toEqual([]);
	});

	it('excludes children below minArea from classification', () => {
		const tiny = cell(0, 0, 5, 5);
		const big = cell(0, 0, 200, 100);
		const root = mockNode({ children: [tiny, big] });

		// Only `big` is meaningful -> single meaningful child -> collapse into it -> leaf (no children of its own).
		const result = classifyLayoutTree(root);
		expect(result.boundingBox).toEqual(big.boundingBox);
		expect(result.layoutType).toBe('leaf');
	});

	it('does not hang on a long single-child wrapper chain (collapse safety bound)', () => {
		let node = cell(0, 0, 100, 100, { id: 'deepest' });
		for (let i = 0; i < 100; i++) {
			node = mockNode({ children: [node] });
		}

		const result = classifyLayoutTree(node);

		// Should terminate and produce some deterministic result rather than
		// looping forever — the exact id reached depends on MAX_COLLAPSE_CHAIN,
		// which is an implementation detail this test intentionally doesn't pin.
		expect(result).toBeDefined();
	});
});
