import { describe, expect, test } from 'vitest';

import { groupIndicesByBlockKey, resolveBlockKeys } from './pass0-blocking.js';

describe('resolveBlockKeys', () => {
	test('returns one block key per input page in order', () => {
		// Third page with a *different* stylesheet keeps a.css from being
		// 100%-common, so its frequency stays below the common-href cutoff
		// and it survives as a distinctive css: signal for the first two.
		const keys = resolveBlockKeys([
			{ paths: ['news', '1'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['news', '2'], stylesheetHrefs: ['https://example.com/a.css'] },
			{ paths: ['about'], stylesheetHrefs: ['https://example.com/b.css'] },
		]);
		expect(keys).toHaveLength(3);
		expect(keys[0]).toBe(keys[1]);
		expect(keys[0]).toMatch(/^css:/);
		// b.css appears on only one page — below minCssGroupSize=2, so it
		// falls back to path.
		expect(keys[2]).toBe('path:about');
	});

	test('orphan (empty stylesheetHrefs) gets reassigned to same-section css block by default', () => {
		const pages = [
			{
				paths: ['news', '1'],
				stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/shared.css'],
			},
			{
				paths: ['news', '2'],
				stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/shared.css'],
			},
			{
				paths: ['news', '3'],
				stylesheetHrefs: ['https://example.com/shared.css'],
			},
			// Third-differently-styled page anchors the frequency filter so
			// shared.css isn't 100% and a.css stays distinctive.
			{
				paths: ['about'],
				stylesheetHrefs: ['https://example.com/b.css', 'https://example.com/shared.css'],
			},
			// Orphan (no stylesheets) in the news section — should join the
			// news css: block via orphan reassignment.
			{ paths: ['news', '4'], stylesheetHrefs: [] },
		];
		const keys = resolveBlockKeys(pages);
		// reassignOrphanBlockKeys retags every member of the reassigned
		// css: block with the orphan-merge: prefix so the block pool is
		// visibly renamed once an orphan joins — the whole news section
		// shares one orphan-merge: key rather than a mix.
		expect(keys[0]).toMatch(/^orphan-merge:/);
		expect(keys[0]).toBe(keys[4]);
	});

	test('reassignOrphans: false leaves orphan on path key', () => {
		const pages = [
			{
				paths: ['news', '1'],
				stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/shared.css'],
			},
			{
				paths: ['news', '2'],
				stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/shared.css'],
			},
			{
				paths: ['about'],
				stylesheetHrefs: ['https://example.com/b.css', 'https://example.com/shared.css'],
			},
			{ paths: ['news', '4'], stylesheetHrefs: [] },
		];
		const keys = resolveBlockKeys(pages, { reassignOrphans: false });
		expect(keys[3]).toBe('path:news');
	});

	test('per-page host lets third-party fonts get filtered out before blocking', () => {
		// Both pages load their site's own first-party stylesheet plus a
		// third-party font. Without filtering, the font shows up as a
		// distinctive shared href and can affect css: key generation.
		// With `host` provided, direct comparison drops fonts.googleapis.com.
		const pages = [
			{
				paths: ['a'],
				host: 'example.com',
				stylesheetHrefs: [
					'https://example.com/a.css',
					'https://fonts.googleapis.com/css?family=x',
				],
			},
			{
				paths: ['a'],
				host: 'example.com',
				stylesheetHrefs: [
					'https://example.com/a.css',
					'https://fonts.googleapis.com/css?family=x',
				],
			},
		];
		const keys = resolveBlockKeys(pages);
		expect(keys[0]).toBe(keys[1]);
	});

	test('empty input returns empty array', () => {
		expect(resolveBlockKeys([])).toEqual([]);
	});
});

describe('groupIndicesByBlockKey', () => {
	test('groups indices by key, preserving first-seen order of keys and input order within each', () => {
		const groups = groupIndicesByBlockKey(['a', 'b', 'a', 'c', 'a', 'b']);
		expect([...groups.keys()]).toEqual(['a', 'b', 'c']);
		expect(groups.get('a')).toEqual([0, 2, 4]);
		expect(groups.get('b')).toEqual([1, 5]);
		expect(groups.get('c')).toEqual([3]);
	});

	test('empty input returns empty map', () => {
		const groups = groupIndicesByBlockKey([]);
		expect(groups.size).toBe(0);
	});
});
