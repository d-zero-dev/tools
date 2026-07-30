import { describe, expect, it } from 'vitest';

import { mockNode } from './__fixtures__/mock-node.js';
import { detectTablePattern } from './detect-table-pattern.js';

describe('detectTablePattern', () => {
	it('matches a <table> tag regardless of its display value', () => {
		const result = detectTablePattern(
			mockNode({
				tagName: 'TABLE',
				style: {
					display: 'block',
					float: 'none',
					position: 'static',
					visibility: 'visible',
				},
			}),
		);
		expect(result.matched).toBe(true);
		expect(result.confidence).toBe(1);
	});

	it('matches display: table on a non-table tag', () => {
		const result = detectTablePattern(
			mockNode({
				tagName: 'DIV',
				style: {
					display: 'table',
					float: 'none',
					position: 'static',
					visibility: 'visible',
				},
			}),
		);
		expect(result.matched).toBe(true);
		expect(result.confidence).toBe(0.9);
	});

	it('matches the two-value syntax "block table"', () => {
		const result = detectTablePattern(
			mockNode({
				style: {
					display: 'block table',
					float: 'none',
					position: 'static',
					visibility: 'visible',
				},
			}),
		);
		expect(result.matched).toBe(true);
	});

	it('matches table-internal display values', () => {
		const result = detectTablePattern(
			mockNode({
				style: {
					display: 'table-cell',
					float: 'none',
					position: 'static',
					visibility: 'visible',
				},
			}),
		);
		expect(result.matched).toBe(true);
	});

	it('does not match ruby-base, a different internal display value', () => {
		const result = detectTablePattern(
			mockNode({
				style: {
					display: 'ruby-base',
					float: 'none',
					position: 'static',
					visibility: 'visible',
				},
			}),
		);
		expect(result.matched).toBe(false);
	});

	it('does not match a plain block div', () => {
		const result = detectTablePattern(mockNode());
		expect(result.matched).toBe(false);
		expect(result.confidence).toBe(0);
	});

	it('always reports raw signals, even when unmatched', () => {
		const result = detectTablePattern(mockNode());
		expect(result.signals).toMatchObject({ tagName: 'DIV', display: 'block' });
	});
});
