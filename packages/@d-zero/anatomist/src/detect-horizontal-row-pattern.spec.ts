import { describe, expect, it } from 'vitest';

import { mockNode } from './__fixtures__/mock-node.js';
import { clusterIntoRows } from './cluster-into-rows.js';
import { detectHorizontalRowPattern } from './detect-horizontal-row-pattern.js';

/**
 * @param children
 */
function detect(children: ReturnType<typeof mockNode>[]) {
	return detectHorizontalRowPattern(clusterIntoRows(children), children.length);
}

describe('detectHorizontalRowPattern', () => {
	it('does not match fewer than two children', () => {
		expect(detect([mockNode()]).matched).toBe(false);
	});

	it('matches when all children share a single row', () => {
		const children = [
			mockNode({ boundingBox: { x: 0, y: 0, width: 100, height: 40 } }),
			mockNode({ boundingBox: { x: 120, y: 0, width: 100, height: 40 } }),
			mockNode({ boundingBox: { x: 240, y: 0, width: 100, height: 40 } }),
		];
		const result = detect(children);
		expect(result.matched).toBe(true);
		expect(result.confidence).toBe(0.8);
	});

	it('does not match when children fall into more than one row', () => {
		const children = [
			mockNode({ boundingBox: { x: 0, y: 0, width: 100, height: 40 } }),
			mockNode({ boundingBox: { x: 0, y: 100, width: 100, height: 40 } }),
		];
		expect(detect(children).matched).toBe(false);
	});
});
