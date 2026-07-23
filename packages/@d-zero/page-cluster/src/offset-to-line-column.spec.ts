import { describe, expect, test } from 'vitest';

import { buildLineColumnIndex, offsetToLineColumn } from './offset-to-line-column.js';

describe('offsetToLineColumn', () => {
	test('single-line string', () => {
		const index = buildLineColumnIndex('abc');
		expect(offsetToLineColumn(index, 0)).toStrictEqual({ line: 1, column: 1 });
		expect(offsetToLineColumn(index, 2)).toStrictEqual({ line: 1, column: 3 });
	});

	test('multi-line string resolves offsets on each line', () => {
		const html = 'ab\ncd';
		const index = buildLineColumnIndex(html);
		expect(offsetToLineColumn(index, 0)).toStrictEqual({ line: 1, column: 1 }); // 'a'
		expect(offsetToLineColumn(index, 1)).toStrictEqual({ line: 1, column: 2 }); // 'b'
		expect(offsetToLineColumn(index, 3)).toStrictEqual({ line: 2, column: 1 }); // 'c'
		expect(offsetToLineColumn(index, 4)).toStrictEqual({ line: 2, column: 2 }); // 'd'
	});

	test('offset immediately after a newline starts the next line at column 1', () => {
		const html = 'ab\ncd';
		const index = buildLineColumnIndex(html);
		// offset 3 is 'c', the character right after the '\n' at offset 2
		expect(offsetToLineColumn(index, 3)).toStrictEqual({ line: 2, column: 1 });
	});

	test('the newline character itself belongs to the line it terminates', () => {
		const html = 'ab\ncd';
		const index = buildLineColumnIndex(html);
		expect(offsetToLineColumn(index, 2)).toStrictEqual({ line: 1, column: 3 });
	});

	test('offset at the end of the string (exclusive end, e.g. endOffset)', () => {
		const html = 'ab\ncd';
		const index = buildLineColumnIndex(html);
		expect(offsetToLineColumn(index, html.length)).toStrictEqual({ line: 2, column: 3 });
	});

	test('empty string', () => {
		const index = buildLineColumnIndex('');
		expect(offsetToLineColumn(index, 0)).toStrictEqual({ line: 1, column: 1 });
	});

	test('CRLF: \\r is counted as the last column of its own line', () => {
		const html = 'ab\r\ncd';
		const index = buildLineColumnIndex(html);
		expect(offsetToLineColumn(index, 2)).toStrictEqual({ line: 1, column: 3 }); // '\r'
		expect(offsetToLineColumn(index, 3)).toStrictEqual({ line: 1, column: 4 }); // '\n'
		expect(offsetToLineColumn(index, 4)).toStrictEqual({ line: 2, column: 1 }); // 'c'
	});

	test('the same index can be reused across multiple offsets', () => {
		const html = 'one\ntwo\nthree';
		const index = buildLineColumnIndex(html);
		expect(offsetToLineColumn(index, 0)).toStrictEqual({ line: 1, column: 1 });
		expect(offsetToLineColumn(index, 4)).toStrictEqual({ line: 2, column: 1 });
		expect(offsetToLineColumn(index, 8)).toStrictEqual({ line: 3, column: 1 });
	});
});
