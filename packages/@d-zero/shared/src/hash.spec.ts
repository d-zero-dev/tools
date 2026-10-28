import { describe, test, expect } from 'vitest';

import { hash } from './hash.js';

describe('hash', () => {
	test('returns the hex SHA-256 digest of an empty string', () => {
		expect(hash('')).toBe(
			'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		);
	});

	test('returns the hex SHA-256 digest of an ASCII string', () => {
		expect(hash('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
		);
	});

	test('hashes non-ASCII input as its UTF-8 bytes', () => {
		// SHA-256 of the bytes E3 81 82 (U+3042 in UTF-8)
		expect(hash('あ')).toBe(
			'dc5a4d3d82f7e15792959dc661538ae0e541ce66494516f5c9cfd9cd3308494d',
		);
	});
});
