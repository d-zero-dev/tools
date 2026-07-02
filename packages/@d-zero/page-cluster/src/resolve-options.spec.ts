import { describe, expect, test } from 'vitest';

import { resolveOptions } from './resolve-options.js';

describe('resolveOptions', () => {
	test('defaults filterNoiseClasses to true and includeComments to false', () => {
		expect(resolveOptions()).toStrictEqual({
			filterNoiseClasses: true,
			includeComments: false,
		});
	});

	test('respects explicit overrides', () => {
		expect(
			resolveOptions({ filterNoiseClasses: false, includeComments: true }),
		).toStrictEqual({
			filterNoiseClasses: false,
			includeComments: true,
		});
	});
});
