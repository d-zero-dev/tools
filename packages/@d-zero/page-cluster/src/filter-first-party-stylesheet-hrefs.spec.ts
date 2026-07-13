import { describe, expect, test } from 'vitest';

import { filterFirstPartyStylesheetHrefs } from './filter-first-party-stylesheet-hrefs.js';

describe('filterFirstPartyStylesheetHrefs', () => {
	test('matches the exact output documented in the JSDoc @example', () => {
		// Kept in sync with filterFirstPartyStylesheetHrefs's @example: if this
		// ever fails, the JSDoc example is out of date and must be corrected
		// alongside the implementation, not the other way around.
		const result = filterFirstPartyStylesheetHrefs([
			{ stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/b.css'] },
			{
				stylesheetHrefs: [
					'https://example.com/a.css',
					'https://fonts.googleapis.com/css?family=x',
				],
			},
		]);
		expect(result).toStrictEqual([
			{ stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/b.css'] },
			{ stylesheetHrefs: ['https://example.com/a.css'] },
		]);
	});

	test('an empty page list returns an empty array', () => {
		expect(filterFirstPartyStylesheetHrefs([])).toEqual([]);
	});

	test('a batch where every page loads no stylesheets is returned unchanged', () => {
		const pages = [{ stylesheetHrefs: [] }, { stylesheetHrefs: [] }];
		expect(filterFirstPartyStylesheetHrefs(pages)).toStrictEqual(pages);
	});

	test('a single distinctive third-party href on an otherwise first-party page is dropped, not merely deduplicated', () => {
		const result = filterFirstPartyStylesheetHrefs([
			{ stylesheetHrefs: ['https://example.com/a.css'] },
			{
				stylesheetHrefs: [
					'https://example.com/a.css',
					'https://www.youtube.com/s/player.css',
				],
			},
		]);
		expect(result[1]?.stylesheetHrefs).toEqual(['https://example.com/a.css']);
	});

	test('a tie between two equally common origins keeps the first one encountered and drops the other', () => {
		const result = filterFirstPartyStylesheetHrefs([
			{ stylesheetHrefs: ['https://a.example.com/x.css'] },
			{ stylesheetHrefs: ['https://b.example.com/y.css'] },
		]);
		expect(result[0]?.stylesheetHrefs).toEqual(['https://a.example.com/x.css']);
		expect(result[1]?.stylesheetHrefs).toEqual([]);
	});

	test('a page-supplied host resolves a tie the dominant-host fallback would get wrong (regression test for the real crawl finding)', () => {
		// Every page loads both its own first-party stylesheet and the same
		// sitewide third-party webfont — tying "referenced by 100% of pages"
		// between the real first party and the third party. Without `host`,
		// the fallback's tie-break is arbitrary (see the test above); with
		// `host` supplied, the third party is dropped correctly regardless of
		// which host the batch-wide count would have favored.
		const result = filterFirstPartyStylesheetHrefs([
			{
				host: 'example.com',
				stylesheetHrefs: [
					'https://fonts.googleapis.com/css?family=x',
					'https://example.com/a.css',
				],
			},
			{
				host: 'example.com',
				stylesheetHrefs: [
					'https://fonts.googleapis.com/css?family=x',
					'https://example.com/b.css',
				],
			},
		]);
		expect(result[0]?.stylesheetHrefs).toEqual(['https://example.com/a.css']);
		expect(result[1]?.stylesheetHrefs).toEqual(['https://example.com/b.css']);
	});

	test('a page without a supplied host still falls back to dominant-host inference, unaffected by other pages that do supply one', () => {
		const result = filterFirstPartyStylesheetHrefs([
			{ host: 'example.com', stylesheetHrefs: ['https://example.com/a.css'] },
			{
				stylesheetHrefs: [
					'https://example.com/a.css',
					'https://fonts.googleapis.com/css',
				],
			},
		]);
		expect(result[0]?.stylesheetHrefs).toEqual(['https://example.com/a.css']);
		expect(result[1]?.stylesheetHrefs).toEqual(['https://example.com/a.css']);
	});

	test('unparsable hrefs are dropped and never treated as an origin', () => {
		const result = filterFirstPartyStylesheetHrefs([
			{ stylesheetHrefs: ['https://example.com/a.css', 'not a url'] },
			{ stylesheetHrefs: ['https://example.com/a.css'] },
		]);
		expect(result[0]?.stylesheetHrefs).toEqual(['https://example.com/a.css']);
	});

	test('a third-party host referenced by two <link> tags on the same page does not outvote a first-party host referenced by one <link> tag per page', () => {
		// Dominance is measured by how many *pages* reference a host at least
		// once, not by how many hrefs reference it in total — otherwise a page
		// embedding two third-party font requests could outvote the site's own
		// single first-party stylesheet.
		const result = filterFirstPartyStylesheetHrefs([
			{
				stylesheetHrefs: [
					'https://example.com/site.css',
					'https://fonts.googleapis.com/css?family=a',
					'https://fonts.googleapis.com/css?family=b',
				],
			},
			{ stylesheetHrefs: ['https://example.com/site.css'] },
		]);
		expect(result[0]?.stylesheetHrefs).toEqual(['https://example.com/site.css']);
		expect(result[1]?.stylesheetHrefs).toEqual(['https://example.com/site.css']);
	});

	test('the same first-party host served over http and https is treated as one host, not two competing hosts', () => {
		const result = filterFirstPartyStylesheetHrefs([
			{ stylesheetHrefs: ['http://example.com/a.css'] },
			{ stylesheetHrefs: ['https://example.com/a.css'] },
			{
				stylesheetHrefs: ['https://cdn-evil.com/x.css', 'https://cdn-evil.com/y.css'],
			},
		]);
		expect(result[0]?.stylesheetHrefs).toEqual(['http://example.com/a.css']);
		expect(result[1]?.stylesheetHrefs).toEqual(['https://example.com/a.css']);
		expect(result[2]?.stylesheetHrefs).toEqual([]);
	});

	test('fields other than stylesheetHrefs are preserved unchanged', () => {
		const result = filterFirstPartyStylesheetHrefs([
			{
				paths: ['news', '1'],
				stylesheetHrefs: [
					'https://example.com/a.css',
					'https://fonts.googleapis.com/css',
				],
			},
			{ paths: ['news', '2'], stylesheetHrefs: ['https://example.com/a.css'] },
		]);
		expect(result[0]).toStrictEqual({
			paths: ['news', '1'],
			stylesheetHrefs: ['https://example.com/a.css'],
		});
	});
});
