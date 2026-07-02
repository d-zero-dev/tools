import { describe, expect, test } from 'vitest';

import { isFoldCandidate } from './is-fold-candidate.js';

describe('isFoldCandidate', () => {
	test('class-less, role-less, type-less div/span are candidates', () => {
		expect(isFoldCandidate('div', [])).toBe(true);
		expect(isFoldCandidate('span', [])).toBe(true);
	});

	test('a class disqualifies div/span', () => {
		expect(isFoldCandidate('div', ['card'])).toBe(false);
	});

	test('a role disqualifies div/span', () => {
		expect(isFoldCandidate('div', [], 'button')).toBe(false);
	});

	test('a type disqualifies div/span', () => {
		expect(isFoldCandidate('span', [], undefined, 'text')).toBe(false);
	});

	test('non-div/span tags are never candidates', () => {
		expect(isFoldCandidate('ul', [])).toBe(false);
		expect(isFoldCandidate('li', [])).toBe(false);
	});
});
