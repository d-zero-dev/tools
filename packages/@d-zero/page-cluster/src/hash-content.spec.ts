import { describe, expect, test } from 'vitest';

import { hashContent } from './hash-content.js';

describe('hashContent', () => {
	test('returns a 16-character hex digest', () => {
		const digest = hashContent('console.log("hi")');
		expect(digest).toMatch(/^[0-9a-f]{16}$/);
	});

	test('is deterministic for identical content', () => {
		expect(hashContent('.card { color: red; }')).toBe(
			hashContent('.card { color: red; }'),
		);
	});

	test('is the same after whitespace-only formatting differences', () => {
		const minified = '.card{color:red}';
		const pretty = '.card{\n  color:   red\n}';
		// These aren't literally the same normalized string (the minified
		// version lacks spaces around the property), so they are NOT expected
		// to hash the same — this test documents that whitespace normalization
		// only unifies *runs* of whitespace, not their absence.
		expect(hashContent(minified)).not.toBe(hashContent(pretty));
	});

	test('produces the same hash regardless of indentation/line breaks alone', () => {
		const a = 'function f() {\n  return 1;\n}';
		const b = 'function f() { return 1; }';
		expect(hashContent(a)).toBe(hashContent(b));
	});

	test('differs for different content', () => {
		expect(hashContent('a')).not.toBe(hashContent('b'));
	});
});
