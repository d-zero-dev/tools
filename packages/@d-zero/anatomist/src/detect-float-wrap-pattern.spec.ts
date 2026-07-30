import { describe, expect, it } from 'vitest';

import { mockNode } from './__fixtures__/mock-node.js';
import { detectFloatWrapPattern } from './detect-float-wrap-pattern.js';

describe('detectFloatWrapPattern', () => {
	it('does not match when no child is floated media', () => {
		const children = [mockNode(), mockNode()];
		expect(detectFloatWrapPattern(children).matched).toBe(false);
	});

	it('does not match a floated image with no overlapping sibling', () => {
		const image = mockNode({
			tagName: 'IMG',
			style: {
				display: 'block',
				float: 'left',
				position: 'static',
				visibility: 'visible',
			},
			boundingBox: { x: 0, y: 0, width: 100, height: 100 },
		});
		const paragraph = mockNode({
			tagName: 'P',
			boundingBox: { x: 0, y: 200, width: 300, height: 40 },
		});
		expect(detectFloatWrapPattern([image, paragraph]).matched).toBe(false);
	});

	it('matches a floated image overlapping a text sibling (text wraps around it)', () => {
		const image = mockNode({
			tagName: 'IMG',
			style: {
				display: 'block',
				float: 'left',
				position: 'static',
				visibility: 'visible',
			},
			boundingBox: { x: 0, y: 0, width: 100, height: 100 },
		});
		const paragraph = mockNode({
			tagName: 'P',
			boundingBox: { x: 0, y: 0, width: 300, height: 150 },
		});
		const result = detectFloatWrapPattern([image, paragraph]);
		expect(result.matched).toBe(true);
		expect(result.confidence).toBe(0.75);
	});

	it('ignores a non-media floated element (e.g. a floated div is not "media")', () => {
		const floatedDiv = mockNode({
			tagName: 'DIV',
			style: {
				display: 'block',
				float: 'left',
				position: 'static',
				visibility: 'visible',
			},
		});
		const other = mockNode({ boundingBox: { x: 0, y: 0, width: 100, height: 100 } });
		expect(detectFloatWrapPattern([floatedDiv, other]).matched).toBe(false);
	});
});
