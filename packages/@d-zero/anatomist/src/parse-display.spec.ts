import { describe, expect, it } from 'vitest';

import { parseDisplay } from './parse-display.js';

describe('parseDisplay', () => {
	it.each([
		[
			'block',
			{ kind: 'box-generating', outside: 'block', inside: 'flow', listItem: false },
		],
		[
			'inline',
			{ kind: 'box-generating', outside: 'inline', inside: 'flow', listItem: false },
		],
		[
			'inline-block',
			{ kind: 'box-generating', outside: 'inline', inside: 'flow-root', listItem: false },
		],
		[
			'flow-root',
			{ kind: 'box-generating', outside: 'block', inside: 'flow-root', listItem: false },
		],
		[
			'flex',
			{ kind: 'box-generating', outside: 'block', inside: 'flex', listItem: false },
		],
		[
			'inline-flex',
			{ kind: 'box-generating', outside: 'inline', inside: 'flex', listItem: false },
		],
		[
			'grid',
			{ kind: 'box-generating', outside: 'block', inside: 'grid', listItem: false },
		],
		[
			'inline-grid',
			{ kind: 'box-generating', outside: 'inline', inside: 'grid', listItem: false },
		],
		[
			'table',
			{ kind: 'box-generating', outside: 'block', inside: 'table', listItem: false },
		],
		[
			'inline-table',
			{ kind: 'box-generating', outside: 'inline', inside: 'table', listItem: false },
		],
	] as const)('normalizes legacy keyword %s', (raw, expected) => {
		expect(parseDisplay(raw)).toEqual(expected);
	});

	it.each([
		[
			'block flex',
			{ kind: 'box-generating', outside: 'block', inside: 'flex', listItem: false },
		],
		[
			'inline flex',
			{ kind: 'box-generating', outside: 'inline', inside: 'flex', listItem: false },
		],
		[
			'inline grid',
			{ kind: 'box-generating', outside: 'inline', inside: 'grid', listItem: false },
		],
		[
			'block flow-root',
			{ kind: 'box-generating', outside: 'block', inside: 'flow-root', listItem: false },
		],
		// Token order shouldn't matter.
		[
			'flex block',
			{ kind: 'box-generating', outside: 'block', inside: 'flex', listItem: false },
		],
	] as const)('parses two-value syntax %s', (raw, expected) => {
		expect(parseDisplay(raw)).toEqual(expected);
	});

	it('parses list-item alone as a block box with listItem set', () => {
		expect(parseDisplay('list-item')).toEqual({
			kind: 'box-generating',
			outside: 'block',
			inside: 'flow',
			listItem: true,
		});
	});

	it('parses list-item combined with a two-value pair', () => {
		expect(parseDisplay('block flow list-item')).toEqual({
			kind: 'box-generating',
			outside: 'block',
			inside: 'flow',
			listItem: true,
		});
	});

	it.each([
		'table-row',
		'table-cell',
		'table-row-group',
		'table-header-group',
		'table-footer-group',
		'table-column',
		'table-column-group',
		'table-caption',
		'ruby-base',
		'ruby-text',
	])('treats %s as an internal display value', (value) => {
		expect(parseDisplay(value)).toEqual({ kind: 'internal', value });
	});

	it('treats "none" as none regardless of surrounding tokens', () => {
		expect(parseDisplay('none')).toEqual({ kind: 'none' });
	});

	it('treats "contents" as contents', () => {
		expect(parseDisplay('contents')).toEqual({ kind: 'contents' });
	});

	it('does not misparse "table-cell" as the table box via substring matching', () => {
		const result = parseDisplay('table-cell');
		expect(result).not.toMatchObject({ kind: 'box-generating', inside: 'table' });
	});

	it('falls back to a block/flow box for an unrecognized single keyword', () => {
		expect(parseDisplay('some-future-keyword')).toEqual({
			kind: 'box-generating',
			outside: 'block',
			inside: 'flow',
			listItem: false,
		});
	});

	it('tolerates extra whitespace between tokens', () => {
		expect(parseDisplay('  inline   grid  ')).toEqual({
			kind: 'box-generating',
			outside: 'inline',
			inside: 'grid',
			listItem: false,
		});
	});
});
