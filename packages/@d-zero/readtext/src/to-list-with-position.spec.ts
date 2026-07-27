import { describe, test, expect } from 'vitest';

import { toListWithPosition } from './to-list-with-position.js';

describe('toListWithPosition', () => {
	test('assigns 1-origin line numbers, skipping blank and comment lines', () => {
		expect(
			toListWithPosition(`item1
# comment

item2
`),
		).toStrictEqual([
			{ value: 'item1', line: 1, column: 1 },
			{ value: 'item2', line: 4, column: 1 },
		]);
	});

	test('reports the column where leading whitespace ends', () => {
		expect(toListWithPosition('  item1\n\titem2\nitem3')).toStrictEqual([
			{ value: 'item1', line: 1, column: 3 },
			{ value: 'item2', line: 2, column: 2 },
			{ value: 'item3', line: 3, column: 1 },
		]);
	});

	test('treats a whitespace-only line as blank', () => {
		expect(toListWithPosition('item1\n   \nitem2')).toStrictEqual([
			{ value: 'item1', line: 1, column: 1 },
			{ value: 'item2', line: 3, column: 1 },
		]);
	});

	test('strips the trailing \\r from CRLF line endings without shifting the column', () => {
		expect(toListWithPosition('item1\r\n  item2\r\n')).toStrictEqual([
			{ value: 'item1', line: 1, column: 1 },
			{ value: 'item2', line: 2, column: 3 },
		]);
	});

	test('returns an empty array for text with no surviving lines', () => {
		expect(toListWithPosition('\n# comment\n\n')).toStrictEqual([]);
	});
});
