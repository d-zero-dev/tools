import { describe, expect, test } from 'vitest';

import { deriveStylesheetGroupKey } from './derive-stylesheet-group-key.js';

describe('deriveStylesheetGroupKey', () => {
	test('an empty array returns a fixed, pinned key', () => {
		expect(deriveStylesheetGroupKey([])).toBe('4f53cda18c2baa0c');
	});

	test('a known two-href input hashes to a pinned literal key', () => {
		expect(
			deriveStylesheetGroupKey([
				'https://example.com/a.css',
				'https://example.com/b.css',
			]),
		).toBe('9742767276316d59');
	});

	test('is deterministic for the same input', () => {
		const hrefs = [
			'https://example.com/assets/site.css',
			'https://example.com/assets/theme.css',
		];
		expect(deriveStylesheetGroupKey(hrefs)).toBe(deriveStylesheetGroupKey(hrefs));
	});

	test('is independent of input order', () => {
		const a = deriveStylesheetGroupKey([
			'https://example.com/a.css',
			'https://example.com/b.css',
		]);
		const b = deriveStylesheetGroupKey([
			'https://example.com/b.css',
			'https://example.com/a.css',
		]);
		expect(a).toBe(b);
	});

	test('different stylesheet sets produce different keys', () => {
		const a = deriveStylesheetGroupKey(['https://example.com/a.css']);
		const b = deriveStylesheetGroupKey([
			'https://example.com/a.css',
			'https://example.com/b.css',
		]);
		expect(a).not.toBe(b);
	});

	test('duplicate hrefs do not change the key compared to the deduplicated set', () => {
		const withDuplicates = deriveStylesheetGroupKey([
			'https://example.com/a.css',
			'https://example.com/a.css',
			'https://example.com/b.css',
		]);
		const deduplicated = deriveStylesheetGroupKey([
			'https://example.com/a.css',
			'https://example.com/b.css',
		]);
		expect(withDuplicates).toBe(deduplicated);
	});

	test('a single href containing a space is not confused with two separately joined hrefs', () => {
		// A naive "\n"-join followed by whitespace-collapsing normalization
		// would make these two collide; JSON-serializing before hashing keeps
		// them distinct.
		const twoHrefs = deriveStylesheetGroupKey([
			'https://example.com/a.css',
			'https://example.com/b.css',
		]);
		const oneHrefWithSpace = deriveStylesheetGroupKey([
			'https://example.com/a.css b.css',
		]);
		expect(twoHrefs).not.toBe(oneHrefWithSpace);
	});
});
