import { describe, expect, test } from 'vitest';

import { resolvePageClusterKeys } from './resolve-page-cluster-keys.js';

describe('resolvePageClusterKeys', () => {
	test('an empty page list returns an empty array', () => {
		expect(resolvePageClusterKeys([])).toEqual([]);
	});

	test('matches the exact output documented in the JSDoc @example', () => {
		// Kept in sync with resolvePageClusterKeys's @example: if this ever
		// fails, the JSDoc example is out of date and must be corrected
		// alongside the implementation, not the other way around.
		const result = resolvePageClusterKeys([
			{ paths: ['news', '1'], stylesheetHrefs: [], tokens: new Set(['body>article']) },
			{ paths: ['news', '2'], stylesheetHrefs: [], tokens: new Set(['body>article']) },
			{ paths: ['about'], stylesheetHrefs: [], tokens: new Set(['body>section']) },
		]);
		expect(result).toEqual([
			'["path:news","cluster:0"]',
			'["path:news","cluster:0"]',
			'["path:about","cluster:0"]',
		]);
	});

	test('two pages that block into the same path group and share an identical structure get the same final key', () => {
		const result = resolvePageClusterKeys([
			{
				paths: ['dept-a', 'page1'],
				stylesheetHrefs: [],
				tokens: new Set(['body>header', 'body>main>.card', 'body>footer']),
			},
			{
				paths: ['dept-a', 'page2'],
				stylesheetHrefs: [],
				tokens: new Set(['body>header', 'body>main>.card', 'body>footer']),
			},
		]);

		expect(result[0]).toBe(result[1]);
	});

	test('pages within the same block but with dissimilar structure get different final keys', () => {
		const result = resolvePageClusterKeys([
			{
				paths: ['dept-a', 'page1'],
				stylesheetHrefs: [],
				tokens: new Set(['body>header', 'body>main>.card', 'body>footer']),
			},
			{
				paths: ['dept-a', 'page2'],
				stylesheetHrefs: [],
				tokens: new Set(['body>header', 'body>main>.card', 'body>footer']),
			},
			{
				paths: ['dept-a', 'page3'],
				stylesheetHrefs: [],
				tokens: new Set(['body>nav', 'body>main>form']),
			},
		]);

		expect(result[0]).toBe(result[1]);
		expect(result[2]).not.toBe(result[0]);
	});

	test('two different blocks that each independently produce local cluster label cluster:0 do not collide', () => {
		// Each page is the sole member of its own path-derived block
		// (`path:dept-a`, `path:dept-b`), so resolveStructuralClusterKeys is
		// called twice and both times labels its one page `cluster:0` —
		// regression test for the cross-block label-collision gap this
		// function exists to close.
		const result = resolvePageClusterKeys([
			{
				paths: ['dept-a', 'page1'],
				stylesheetHrefs: [],
				tokens: new Set(['body>header']),
			},
			{
				paths: ['dept-b', 'page1'],
				stylesheetHrefs: [],
				tokens: new Set(['body>header']),
			},
		]);

		expect(result[0]).not.toBe(result[1]);
	});

	test('a stylesheet-derived block and a path-derived block never collide even with identical local labels', () => {
		// dept-a's two pages share a distinctive stylesheet (css: key); dept-b's
		// lone page has no stylesheet at all and falls back to a path: key.
		// Both blocks' sole/first cluster is locally labeled `cluster:0`.
		const result = resolvePageClusterKeys([
			{
				paths: ['dept-a', 'page1'],
				stylesheetHrefs: ['https://example.com/a.css'],
				tokens: new Set(['body>header']),
			},
			{
				paths: ['dept-a', 'page2'],
				stylesheetHrefs: ['https://example.com/a.css'],
				tokens: new Set(['body>header']),
			},
			{
				paths: ['dept-b', 'page1'],
				stylesheetHrefs: [],
				tokens: new Set(['body>header']),
			},
		]);

		expect(result[0]).toBe(result[1]);
		expect(result[2]).not.toBe(result[0]);
	});

	test('the result preserves input order and length across interleaved blocks', () => {
		const pages = [
			{ paths: ['dept-a', '1'], stylesheetHrefs: [], tokens: new Set(['body>a']) },
			{ paths: ['dept-b', '1'], stylesheetHrefs: [], tokens: new Set(['body>b']) },
			{ paths: ['dept-a', '2'], stylesheetHrefs: [], tokens: new Set(['body>a']) },
			{ paths: ['dept-b', '2'], stylesheetHrefs: [], tokens: new Set(['body>b']) },
		];
		const result = resolvePageClusterKeys(pages);

		expect(result).toHaveLength(pages.length);
		expect(result[0]).toBe(result[2]); // both dept-a, identical structure
		expect(result[1]).toBe(result[3]); // both dept-b, identical structure
		expect(result[0]).not.toBe(result[1]); // different blocks
	});
});
