import { describe, expect, test } from 'vitest';

import { derivePathGroupKey } from './derive-path-group-key.js';

describe('derivePathGroupKey', () => {
	test('an empty path array (root page) returns an empty string', () => {
		expect(derivePathGroupKey([])).toBe('');
	});

	test('defaults to depth 1, keeping only the top-level segment', () => {
		expect(derivePathGroupKey(['dept-a', 'news', '123'])).toBe('dept-a');
	});

	test('depth 2 keeps the first two segments joined by "/"', () => {
		expect(derivePathGroupKey(['dept-a', 'news', '123'], 2)).toBe('dept-a/news');
	});

	test('depth 3 keeps all segments when the array has exactly that many', () => {
		expect(derivePathGroupKey(['dept-a', 'news', '123'], 3)).toBe('dept-a/news/123');
	});

	test('a depth larger than the array length returns all available segments', () => {
		expect(derivePathGroupKey(['about'], 5)).toBe('about');
	});

	test('a single-segment path with the default depth returns that segment', () => {
		expect(derivePathGroupKey(['about'])).toBe('about');
	});

	test.each([0, -1, 0.5, Number.NaN])(
		'rejects a non-positive-integer depth (%s)',
		(depth) => {
			expect(() => derivePathGroupKey(['dept-a'], depth)).toThrow(RangeError);
		},
	);

	test('a trailing empty segment (from a directory-style URL) does not change the key', () => {
		// `parseUrl('https://example.com/dept-a/').paths` is `['dept-a', '']`,
		// while `parseUrl('https://example.com/dept-a').paths` is `['dept-a']`.
		expect(derivePathGroupKey(['dept-a', ''], 2)).toBe(derivePathGroupKey(['dept-a'], 2));
	});

	test('a root path made of only an empty segment returns an empty string', () => {
		expect(derivePathGroupKey([''])).toBe('');
	});

	test('an empty segment anywhere in the array is filtered, not just a trailing one', () => {
		expect(derivePathGroupKey(['dept-a', '', 'news'], 3)).toBe('dept-a/news');
	});
});
