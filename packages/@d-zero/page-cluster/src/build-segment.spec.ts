import { describe, expect, test } from 'vitest';

import { buildSegment } from './build-segment.js';

describe('buildSegment', () => {
	test('div/span with class drop the tag name', () => {
		expect(buildSegment('div', ['card', 'featured'])).toBe('.card.featured');
		expect(buildSegment('span', ['icon'])).toBe('.icon');
	});

	test('div/span without class keep the tag name', () => {
		expect(buildSegment('div', [])).toBe('div');
		expect(buildSegment('span', [])).toBe('span');
	});

	test('other tags always keep the tag name', () => {
		expect(buildSegment('ul', ['list'])).toBe('ul.list');
		expect(buildSegment('ul', [])).toBe('ul');
	});

	test('appends role as a bracket suffix', () => {
		expect(buildSegment('div', ['card'], 'button')).toBe('.card[role=button]');
	});

	test('appends type as a bracket suffix', () => {
		expect(buildSegment('input', [], undefined, 'checkbox')).toBe('input[type=checkbox]');
	});

	test('combines role and type in one bracket, alphabetically', () => {
		expect(buildSegment('input', [], 'switch', 'checkbox')).toBe(
			'input[role=switch,type=checkbox]',
		);
	});

	test('a Tailwind arbitrary-value class is preserved verbatim, brackets and all', () => {
		// Known, accepted limitation: a class containing literal `[`/`]`/`,`
		// can visually collide with this function's own `[key=value]` bracket
		// syntax (e.g. a class literally named `[role=button]` would be
		// indistinguishable from an actual `role` attribute). This is not
		// worth escaping for: Tailwind's arbitrary-value syntax produces CSS
		// property values (`w-[137px]`, `text-[#1da1f2]`), never strings that
		// look like `key=value` metadata, so real crawled markup can't
		// actually trigger the collision.
		expect(buildSegment('div', ['w-[137px]'])).toBe('.w-[137px]');
		expect(buildSegment('div', ['w-[137px]'], 'button')).toBe('.w-[137px][role=button]');
	});
});
