import type { RawLayoutNode } from '../types.js';

/**
 * Builds a minimal `RawLayoutNode` for classify-layer unit tests, so tests
 * can specify only the fields relevant to what they're checking. Not used
 * by production code — test-only fixture.
 * @param overrides
 */
export function mockNode(overrides: Partial<RawLayoutNode> = {}): RawLayoutNode {
	return {
		tagName: 'DIV',
		id: null,
		classList: [],
		boundingBox: { x: 0, y: 0, width: 100, height: 40 },
		style: { display: 'block', float: 'none', position: 'static', visibility: 'visible' },
		innerHTML: '',
		attributes: {},
		children: [],
		...overrides,
	};
}
