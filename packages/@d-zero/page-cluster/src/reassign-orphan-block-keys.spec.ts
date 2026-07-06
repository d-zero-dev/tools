import { describe, expect, test } from 'vitest';

import { reassignOrphanBlockKeys } from './reassign-orphan-block-keys.js';
import { resolveBlockingGroupKeys } from './resolve-blocking-group-keys.js';

describe('reassignOrphanBlockKeys', () => {
	test('matches the exact output documented in the JSDoc @example', () => {
		// Kept in sync with reassignOrphanBlockKeys's @example: if this ever
		// fails, the JSDoc example is out of date and must be corrected
		// alongside the implementation, not the other way around.
		const pages = [
			{ paths: ['news', '1'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['news', '2'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['news', '3'], stylesheetHrefs: [] },
			{ paths: ['about'], stylesheetHrefs: ['https://example.com/b.css'] },
		];
		const blockKeys = resolveBlockingGroupKeys(pages);
		expect(blockKeys[0]).toMatch(/^css:/);
		expect(blockKeys[2]).toBe('path:news');

		const result = reassignOrphanBlockKeys(pages, blockKeys);

		expect(result[0]).toBe('orphan-merge:news');
		expect(result[1]).toBe('orphan-merge:news');
		expect(result[2]).toBe('orphan-merge:news');
		expect(result[3]).toBe('path:about');
	});

	test('a css: block spanning more than one path key ("unconfined") is left unchanged even when an orphan shares one of its path keys', () => {
		// c.css keeps a.css's document frequency below the common-href
		// threshold (2/3 instead of 2/2 = 100%), so a.css stays distinctive
		// enough to form a css: block on its own — see
		// resolve-blocking-group-keys.spec.ts's own tests for this same pattern.
		const pages = [
			{ paths: ['news'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['about'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['news', '2'], stylesheetHrefs: [] },
			{ paths: ['contact'], stylesheetHrefs: ['https://example.com/c.css'] },
		];
		const blockKeys = resolveBlockingGroupKeys(pages);
		expect(blockKeys[0]).toMatch(/^css:/);
		expect(blockKeys[0]).toBe(blockKeys[1]);
		expect(blockKeys[2]).toBe('path:news');

		expect(reassignOrphanBlockKeys(pages, blockKeys)).toEqual(blockKeys);
	});

	test('multiple css: blocks confined to the same path key are all merged together with the orphan', () => {
		const pages = [
			{ paths: ['news', '1'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['news', '2'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['news', '3'], stylesheetHrefs: ['https://example.com/b.css'] },
			{ paths: ['news', '4'], stylesheetHrefs: ['https://example.com/b.css'] },
			{ paths: ['news', '5'], stylesheetHrefs: [] },
		];
		const blockKeys = resolveBlockingGroupKeys(pages);
		expect(blockKeys[0]).toMatch(/^css:/);
		expect(blockKeys[2]).toMatch(/^css:/);
		expect(blockKeys[0]).not.toBe(blockKeys[2]);

		const result = reassignOrphanBlockKeys(pages, blockKeys);

		expect(new Set(result)).toEqual(new Set(['orphan-merge:news']));
	});

	test('an orphan with no confined css: block sharing its path key is left unchanged', () => {
		const pages = [
			{ paths: ['news'], stylesheetHrefs: [] },
			{ paths: ['about'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['about'], stylesheetHrefs: ['https://example.com/a.css'] },
		];
		const blockKeys = ['path:news', 'css:x', 'css:x'];

		expect(reassignOrphanBlockKeys(pages, blockKeys)).toEqual(blockKeys);
	});

	test('a confined css: block with no orphan sharing its path key is left unchanged', () => {
		// c.css dilutes a.css's document frequency below the common-href
		// threshold (2/3 instead of 2/2 = 100%), so a.css actually forms a css:
		// key here — without it, resolveBlockingGroupKeys would filter a.css out
		// as non-discriminative chrome and never produce a css: key at all,
		// making this test pass without ever exercising the branch it names.
		const pages = [
			{ paths: ['news', '1'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['news', '2'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['contact'], stylesheetHrefs: ['https://example.com/c.css'] },
		];
		const blockKeys = resolveBlockingGroupKeys(pages);
		expect(blockKeys[0]).toMatch(/^css:/);

		expect(reassignOrphanBlockKeys(pages, blockKeys)).toEqual(blockKeys);
	});

	test('a non-orphan page sharing the orphan-affected path key (a real, non-discriminative stylesheet, not missing data) is not folded into the merged pool', () => {
		// common.css is loaded by every stylesheet-bearing page (4/4 = 100%), so
		// it is filtered out as non-discriminative chrome. Page 3 loads nothing
		// else, so it falls back to path:news for a genuine reason (no
		// distinctive stylesheet), not because its stylesheet data is missing —
		// `stylesheetHrefs.length` is 1, not 0, so it is not an orphan. It must
		// not be pulled into the same pool as the orphan and the confined css:
		// block: doing so could change which of them the block's own members
		// end up matched with (complete-linkage's min-linkage aggregation lets
		// an unrelated third point in the comparison pool change whether two
		// *other* points clear the similarity threshold together), which this
		// function has no evidence to justify.
		const pages = [
			{
				paths: ['news', '1'],
				stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/common.css'],
			},
			{
				paths: ['news', '2'],
				stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/common.css'],
			},
			{ paths: ['news', '3'], stylesheetHrefs: [] },
			{ paths: ['news', '4'], stylesheetHrefs: ['https://example.com/common.css'] },
			{ paths: ['other', '1'], stylesheetHrefs: ['https://example.com/common.css'] },
		];
		const blockKeys = resolveBlockingGroupKeys(pages);
		expect(blockKeys[0]).toMatch(/^css:/);
		expect(blockKeys[2]).toBe('path:news');
		expect(blockKeys[3]).toBe('path:news');

		const result = reassignOrphanBlockKeys(pages, blockKeys);

		expect(result[0]).toBe('orphan-merge:news');
		expect(result[2]).toBe('orphan-merge:news');
		expect(result[3]).toBe('path:news');
	});

	test('pathDepth is forwarded to derivePathGroupKey so confinement and orphan path keys are computed consistently with resolveBlockingGroupKeys', () => {
		const pages = [
			{ paths: ['dept-a', 'news', '1'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['dept-a', 'news', '2'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['dept-a', 'news', '3'], stylesheetHrefs: [] },
			{ paths: ['dept-b'], stylesheetHrefs: ['https://example.com/b.css'] },
		];
		const blockKeys = resolveBlockingGroupKeys(pages, { pathDepth: 2 });
		expect(blockKeys[2]).toBe('path:dept-a/news');

		const result = reassignOrphanBlockKeys(pages, blockKeys, 2);

		expect(new Set(result.slice(0, 3))).toEqual(new Set(['orphan-merge:dept-a/news']));
	});

	test('an empty page list returns an empty array', () => {
		expect(reassignOrphanBlockKeys([], [])).toEqual([]);
	});

	test('rejects an invalid pathDepth eagerly, even with an empty page list', () => {
		expect(() => reassignOrphanBlockKeys([], [], 0)).toThrow(RangeError);
	});

	test('a batch with no css: keys at all is returned unchanged', () => {
		const pages = [
			{ paths: ['news'], stylesheetHrefs: [] },
			{ paths: ['about'], stylesheetHrefs: [] },
		];
		const blockKeys = ['path:news', 'path:about'];

		expect(reassignOrphanBlockKeys(pages, blockKeys)).toEqual(blockKeys);
	});
});
