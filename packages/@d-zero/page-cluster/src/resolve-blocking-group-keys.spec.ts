import { describe, expect, test } from 'vitest';

import { resolveBlockingGroupKeys } from './resolve-blocking-group-keys.js';

describe('resolveBlockingGroupKeys', () => {
	test('an empty page list returns an empty array', () => {
		expect(resolveBlockingGroupKeys([])).toEqual([]);
	});

	// Shared by the next two tests: a.css is loaded only by the two dept-a
	// pages (2/4 = 50%, below the common-href threshold) while common.css is
	// loaded by all 4 pages (100%, above it).
	const pagesWithOneCommonAndOneDistinctiveHref = [
		{
			paths: ['dept-a', 'news', '1'],
			stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/common.css'],
		},
		{
			paths: ['dept-a', 'news', '2'],
			stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/common.css'],
		},
		{ paths: ['dept-b', 'about'], stylesheetHrefs: ['https://example.com/common.css'] },
		{ paths: ['dept-c', 'contact'], stylesheetHrefs: ['https://example.com/common.css'] },
	];

	test('pages sharing a distinctive stylesheet (below the common-href threshold) get the same css: key', () => {
		const result = resolveBlockingGroupKeys(pagesWithOneCommonAndOneDistinctiveHref);

		expect(result[0]).toBe('css:ac39f3dbf4cdfdbf');
		expect(result[1]).toBe('css:ac39f3dbf4cdfdbf');
	});

	test('a stylesheet shared by every page in the batch carries no discriminative signal and falls back to the path key for all of them', () => {
		// common.css above is present on all 4 pages (100%), so document-frequency
		// filtering strips it before hashing; unrelated dept-b/dept-c pages must
		// not be merged into one group just because they both load only that
		// site-wide common stylesheet.
		const result = resolveBlockingGroupKeys(pagesWithOneCommonAndOneDistinctiveHref);

		expect(result[2]).toBe('path:dept-b');
		expect(result[3]).toBe('path:dept-c');
		expect(result[2]).not.toBe(result[3]);
	});

	test('a stylesheet that is only common relative to stylesheet-bearing pages is still filtered out, even when diluted by stylesheet-less pages', () => {
		// Without excluding stylesheet-less pages from the document-frequency
		// denominator, common.css's frequency would read as 2/10 = 20% (well
		// below the threshold) instead of 2/2 = 100%, wrongly treating it as
		// distinctive and merging two unrelated pages into one css: group.
		const result = resolveBlockingGroupKeys([
			{ paths: ['dept-a', 'about'], stylesheetHrefs: ['https://example.com/common.css'] },
			{ paths: ['dept-b', 'about'], stylesheetHrefs: ['https://example.com/common.css'] },
			...Array.from({ length: 8 }, (_, i) => ({
				paths: ['dept-c', `page-${i}`],
				stylesheetHrefs: [],
			})),
		]);

		expect(result[0]).toBe('path:dept-a');
		expect(result[1]).toBe('path:dept-b');
	});

	test('pages sharing a multi-href distinctive stylesheet set (not just a single href) get the same css: key', () => {
		const result = resolveBlockingGroupKeys([
			{
				paths: ['dept-a', 'news', '1'],
				stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/b.css'],
			},
			{
				paths: ['dept-a', 'news', '2'],
				stylesheetHrefs: ['https://example.com/b.css', 'https://example.com/a.css'],
			},
			{ paths: ['dept-b', 'about'], stylesheetHrefs: ['https://example.com/c.css'] },
		]);

		expect(result[0]).toBe(result[1]);
		expect(result[0]).toMatch(/^css:/);
	});

	test('pages with no stylesheets at all never share a css: bucket and fall back to their own path key', () => {
		const result = resolveBlockingGroupKeys([
			{ paths: ['dept-d', 'x'], stylesheetHrefs: [] },
			{ paths: ['dept-e', 'y'], stylesheetHrefs: [] },
		]);

		expect(result).toEqual(['path:dept-d', 'path:dept-e']);
	});

	test('a stylesheet-based group smaller than minCssGroupSize falls back to the path key', () => {
		// a third, unrelated page keeps a.css's document frequency at 2/3 (below
		// the common-href threshold) instead of 2/2 = 100%, which would
		// otherwise get a.css itself filtered out as non-discriminative.
		const pages = [
			{ paths: ['dept-a', 'news', '1'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['dept-a', 'news', '2'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['dept-b', 'about'], stylesheetHrefs: ['https://example.com/b.css'] },
		];

		expect(resolveBlockingGroupKeys(pages, { minCssGroupSize: 2 })[0]).toBe(
			'css:ac39f3dbf4cdfdbf',
		);
		expect(resolveBlockingGroupKeys(pages, { minCssGroupSize: 3 })[0]).toBe(
			'path:dept-a',
		);
		expect(resolveBlockingGroupKeys(pages, { minCssGroupSize: 3 })[1]).toBe(
			'path:dept-a',
		);
	});

	test('pathDepth is forwarded to derivePathGroupKey for fallback keys', () => {
		const result = resolveBlockingGroupKeys(
			[{ paths: ['dept-a', 'news', '1'], stylesheetHrefs: [] }],
			{ pathDepth: 2 },
		);

		expect(result).toEqual(['path:dept-a/news']);
	});

	test('hrefCommonThreshold is forwarded to splitTokensByFrequency', () => {
		// a.css is shared by 2 of 4 pages (50%). With a threshold looser than
		// that (0.4), it counts as "common" too and both dept-a pages fall back
		// to their path key instead of matching via css:.
		const result = resolveBlockingGroupKeys(
			[
				{
					paths: ['dept-a', 'news', '1'],
					stylesheetHrefs: ['https://example.com/a.css'],
				},
				{
					paths: ['dept-a', 'news', '2'],
					stylesheetHrefs: ['https://example.com/a.css'],
				},
				{ paths: ['dept-b', 'about'], stylesheetHrefs: ['https://example.com/b.css'] },
				{ paths: ['dept-c', 'contact'], stylesheetHrefs: ['https://example.com/c.css'] },
			],
			{ hrefCommonThreshold: 0.4 },
		);

		expect(result[0]).toBe('path:dept-a');
		expect(result[1]).toBe('path:dept-a');
	});

	test.each([1, 0, -1, 0.5, Number.NaN])(
		'rejects a minCssGroupSize below 2 (%s)',
		(minCssGroupSize) => {
			expect(() => resolveBlockingGroupKeys([], { minCssGroupSize })).toThrow(RangeError);
		},
	);

	test('rejects an invalid pathDepth eagerly, even with an empty page list', () => {
		expect(() => resolveBlockingGroupKeys([], { pathDepth: 0 })).toThrow(RangeError);
	});

	test('rejects an invalid hrefCommonThreshold eagerly, even with an empty page list', () => {
		expect(() => resolveBlockingGroupKeys([], { hrefCommonThreshold: -1 })).toThrow(
			RangeError,
		);
	});
});
