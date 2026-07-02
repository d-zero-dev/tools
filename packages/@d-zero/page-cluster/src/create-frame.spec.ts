import { describe, expect, test } from 'vitest';

import { createFrame } from './create-frame.js';
import { resolveOptions } from './resolve-options.js';

describe('createFrame', () => {
	test('builds a frame for a plain tag', () => {
		const frame = createFrame('ul', {}, resolveOptions());
		expect(frame).toStrictEqual({
			tagName: 'ul',
			segment: 'ul',
			isFoldCandidate: false,
			childElementCount: 0,
			pendingPaths: [],
		});
	});

	test('is a fold candidate for a class-less div', () => {
		const frame = createFrame('div', {}, resolveOptions());
		expect(frame.isFoldCandidate).toBe(true);
		expect(frame.segment).toBe('div');
	});

	test('becomes a fold candidate again once noise-class filtering empties its class list', () => {
		const frame = createFrame(
			'div',
			{ class: 'sc-bdVaJa' },
			resolveOptions({ filterNoiseClasses: true }),
		);
		// Once the only class is filtered out as noise, this is equivalent to a
		// class-less div and becomes fold-eligible again.
		expect(frame.isFoldCandidate).toBe(true);
		expect(frame.segment).toBe('div');
	});

	test('id/data-*/non-role aria-* attributes are ignored entirely', () => {
		const frame = createFrame(
			'div',
			{
				id: 'product-12345',
				'data-testid': 'card-42',
				'aria-label': 'Product card',
				'aria-current': 'page',
				class: 'card',
			},
			resolveOptions(),
		);
		expect(frame.segment).toBe('.card');
	});
});
