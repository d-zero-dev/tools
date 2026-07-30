import { describe, expect, it } from 'vitest';

import { mockNode } from './__fixtures__/mock-node.js';
import { clusterIntoRows } from './cluster-into-rows.js';
import { detectVerticalStackPattern } from './detect-vertical-stack-pattern.js';

/**
 * @param children
 */
function detect(children: ReturnType<typeof mockNode>[]) {
	return detectVerticalStackPattern(clusterIntoRows(children), children.length);
}

describe('detectVerticalStackPattern', () => {
	it('does not match zero children', () => {
		expect(detect([]).matched).toBe(false);
	});

	it('matches a single child (degenerate stack of one)', () => {
		expect(detect([mockNode()]).matched).toBe(true);
	});

	it('matches children stacked one per row', () => {
		const children = [
			mockNode({ boundingBox: { x: 0, y: 0, width: 200, height: 40 } }),
			mockNode({ boundingBox: { x: 0, y: 50, width: 200, height: 40 } }),
			mockNode({ boundingBox: { x: 0, y: 100, width: 200, height: 40 } }),
		];
		const result = detect(children);
		expect(result.matched).toBe(true);
		expect(result.confidence).toBe(0.8);
	});

	it('does not match when any row has more than one child', () => {
		const children = [
			mockNode({ boundingBox: { x: 0, y: 0, width: 100, height: 40 } }),
			mockNode({ boundingBox: { x: 120, y: 0, width: 100, height: 40 } }),
		];
		expect(detect(children).matched).toBe(false);
	});
});
