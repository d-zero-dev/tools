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
});
