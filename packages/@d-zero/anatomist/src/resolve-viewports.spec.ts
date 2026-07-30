import { describe, expect, it } from 'vitest';

import { DEFAULT_VIEWPORTS } from './default-viewports.js';
import { resolveViewports } from './resolve-viewports.js';

describe('resolveViewports', () => {
	it('returns the default preset list when no specs are given', () => {
		expect(resolveViewports([])).toBe(DEFAULT_VIEWPORTS);
	});

	it('parses explicit specs, replacing rather than extending the defaults', () => {
		expect(resolveViewports(['wide:1920'])).toEqual([{ name: 'wide', width: 1920 }]);
	});

	it('parses multiple specs in the given order', () => {
		expect(resolveViewports(['a:100', 'b:200'])).toEqual([
			{ name: 'a', width: 100 },
			{ name: 'b', width: 200 },
		]);
	});
});
