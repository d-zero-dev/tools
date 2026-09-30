import { describe, expect, test } from 'vitest';

import { resolveOptions } from './resolve-options.js';

describe('resolveOptions', () => {
	test('defaults filterNoiseClasses to true, includeComments to false and allowedClasses to undefined', () => {
		expect(resolveOptions()).toStrictEqual({
			filterNoiseClasses: true,
			includeComments: false,
			allowedClasses: undefined,
		});
	});

	test('respects explicit overrides', () => {
		const allowedClasses = new Set(['card']);
		expect(
			resolveOptions({
				filterNoiseClasses: false,
				includeComments: true,
				allowedClasses,
			}),
		).toStrictEqual({
			filterNoiseClasses: false,
			includeComments: true,
			allowedClasses,
		});
	});
});
