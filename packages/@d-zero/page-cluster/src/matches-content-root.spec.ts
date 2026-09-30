import { describe, expect, test } from 'vitest';

import { matchesContentRoot } from './matches-content-root.js';

describe('matchesContentRoot', () => {
	test('matches the exact output documented in the JSDoc @example', () => {
		const root = { tagName: 'DIV', id: 'main', classList: ['spc'] };
		expect(matchesContentRoot(root, 'div', { id: 'main', class: 'spc wide' })).toBe(true);
		expect(matchesContentRoot(root, 'div', { id: 'main' })).toBe(false);
		expect(matchesContentRoot({}, 'div', { id: 'main' })).toBe(false);
	});

	test('tagName compares case-insensitively', () => {
		expect(matchesContentRoot({ tagName: 'DIV' }, 'div', {})).toBe(true);
		expect(matchesContentRoot({ tagName: 'div' }, 'section', {})).toBe(false);
	});

	test('id must match exactly', () => {
		expect(matchesContentRoot({ id: 'main' }, 'div', { id: 'main' })).toBe(true);
		expect(matchesContentRoot({ id: 'main' }, 'div', { id: 'main-content' })).toBe(false);
		expect(matchesContentRoot({ id: 'main' }, 'div', {})).toBe(false);
	});

	test('role must match exactly', () => {
		expect(matchesContentRoot({ role: 'main' }, 'div', { role: 'main' })).toBe(true);
		expect(matchesContentRoot({ role: 'main' }, 'div', { role: 'banner' })).toBe(false);
	});

	test('classList is a subset match, independent of order and of extra classes', () => {
		expect(matchesContentRoot({ classList: ['b', 'a'] }, 'div', { class: 'a x b' })).toBe(
			true,
		);
		expect(matchesContentRoot({ classList: ['a', 'c'] }, 'div', { class: 'a b' })).toBe(
			false,
		);
	});

	test('the element class attribute is split on any run of whitespace', () => {
		expect(
			matchesContentRoot({ classList: ['a', 'b'] }, 'div', { class: '  a \n\t b  ' }),
		).toBe(true);
	});

	test('every given field must match the same element', () => {
		const root = { tagName: 'div', id: 'main', role: 'main', classList: ['spc'] };
		expect(
			matchesContentRoot(root, 'div', { id: 'main', role: 'main', class: 'spc' }),
		).toBe(true);
		expect(matchesContentRoot(root, 'div', { id: 'main', class: 'spc' })).toBe(false);
		expect(
			matchesContentRoot(root, 'section', { id: 'main', role: 'main', class: 'spc' }),
		).toBe(false);
	});

	test('a root with no constraint matches nothing, and so do empty strings and empty arrays', () => {
		expect(matchesContentRoot({}, 'div', { id: 'main' })).toBe(false);
		expect(matchesContentRoot({ tagName: '', id: '', role: '' }, 'div', {})).toBe(false);
		expect(matchesContentRoot({ classList: [] }, 'div', { class: 'a' })).toBe(false);
		expect(matchesContentRoot({ classList: [''] }, 'div', { class: 'a' })).toBe(false);
	});

	test('empty strings and empty arrays are ignored next to real constraints', () => {
		expect(
			matchesContentRoot({ tagName: '', id: 'main', classList: [] }, 'div', {
				id: 'main',
			}),
		).toBe(true);
	});

	test('<body> never matches, however it is described', () => {
		expect(matchesContentRoot({ id: 'main' }, 'body', { id: 'main' })).toBe(false);
		expect(matchesContentRoot({ tagName: 'body' }, 'body', {})).toBe(false);
		expect(matchesContentRoot({ classList: ['home'] }, 'body', { class: 'home' })).toBe(
			false,
		);
	});
});

describe('matchesContentRoot (edge cases)', () => {
	test('a whitespace-only class attribute has no classes', () => {
		expect(matchesContentRoot({ classList: ['a'] }, 'div', { class: '   ' })).toBe(false);
	});

	test('a classList constraint on an element with no class attribute never matches', () => {
		expect(matchesContentRoot({ classList: ['a'] }, 'div', {})).toBe(false);
	});

	test('duplicate classes in the constraint need only one occurrence on the element', () => {
		expect(matchesContentRoot({ classList: ['a', 'a'] }, 'div', { class: 'a' })).toBe(
			true,
		);
	});

	test('class and role comparisons are case-sensitive', () => {
		expect(matchesContentRoot({ classList: ['Main'] }, 'div', { class: 'main' })).toBe(
			false,
		);
		expect(matchesContentRoot({ role: 'Main' }, 'div', { role: 'main' })).toBe(false);
	});
});
