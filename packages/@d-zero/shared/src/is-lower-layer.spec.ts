import { describe, expect, it } from 'vitest';

import { isLowerLayer } from './is-lower-layer.js';
import { tryParseUrl } from './parse-url.js';

it('isLowerLayer', () => {
	expect(isLowerLayer('https://hostname.domain', 'https://hostname2.domain')).toBe(false);
	expect(isLowerLayer('https://hostname.domain', 'https://hostname.domain')).toBe(true);
	expect(isLowerLayer('https://hostname.domain/', 'https://hostname.domain')).toBe(true);
	expect(isLowerLayer('https://hostname.domain', 'https://hostname.domain/')).toBe(true);
	expect(isLowerLayer('https://hostname.domain', 'https://hostname.domain/a')).toBe(
		false,
	);
	expect(isLowerLayer('https://hostname.domain/a', 'https://hostname.domain')).toBe(true);
	expect(isLowerLayer('https://hostname.domain/a', 'https://hostname.domain/a')).toBe(
		true,
	);
	expect(isLowerLayer('https://hostname.domain/a', 'https://hostname.domain/b')).toBe(
		false,
	);
	expect(isLowerLayer('https://hostname.domain/a/b', 'https://hostname.domain/a')).toBe(
		true,
	);
	expect(isLowerLayer('https://hostname.domain/a/b', 'https://hostname.domain/a/')).toBe(
		true,
	);
	expect(isLowerLayer('https://hostname.domain/a/b/c', 'https://hostname.domain/a')).toBe(
		true,
	);
	expect(
		isLowerLayer('https://hostname.domain/a/b/c', 'https://hostname.domain/a/'),
	).toBe(true);
	expect(
		isLowerLayer('https://hostname.domain/a/b/c/d', 'https://hostname.domain/a/b'),
	).toBe(true);
	expect(
		isLowerLayer('https://hostname.domain/a/b/c/d', 'https://hostname.domain/a/b/'),
	).toBe(true);
	expect(
		isLowerLayer('https://hostname.domain/a/b/c/d', 'https://hostname.domain/b/b/c/'),
	).toBe(false);
});

describe('paths mutation bug fix', () => {
	it('does not mutate ExURL paths array', () => {
		const target = tryParseUrl('https://hostname.domain/a/b/c')!;
		const base = tryParseUrl('https://hostname.domain/a')!;
		const targetPathsBefore = [...target.paths];
		const basePathsBefore = [...base.paths];

		isLowerLayer(target, base);

		expect(target.paths).toEqual(targetPathsBefore);
		expect(base.paths).toEqual(basePathsBefore);
	});

	it('can be called multiple times with same ExURL objects', () => {
		const target = tryParseUrl('https://hostname.domain/a/b/c')!;
		const base = tryParseUrl('https://hostname.domain/a')!;

		expect(isLowerLayer(target, base)).toBe(true);
		expect(isLowerLayer(target, base)).toBe(true);
		expect(isLowerLayer(target, base)).toBe(true);
	});
});
