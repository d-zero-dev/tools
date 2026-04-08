import { describe, it, expect } from 'vitest';

import {
	NETWORK_DISCONNECTION_ERRORS,
	findDisconnectionFailures,
} from './network-disconnection.js';

describe('NETWORK_DISCONNECTION_ERRORS', () => {
	it('contains the expected error codes', () => {
		expect(NETWORK_DISCONNECTION_ERRORS.has('net::ERR_NETWORK_CHANGED')).toBe(true);
		expect(NETWORK_DISCONNECTION_ERRORS.has('net::ERR_INTERNET_DISCONNECTED')).toBe(true);
		expect(NETWORK_DISCONNECTION_ERRORS.has('net::ERR_CONNECTION_RESET')).toBe(true);
		expect(NETWORK_DISCONNECTION_ERRORS.has('net::ERR_NETWORK_IO_SUSPENDED')).toBe(true);
		expect(NETWORK_DISCONNECTION_ERRORS.has('net::ERR_CONNECTION_TIMED_OUT')).toBe(true);
	});

	it('does not contain unrelated error codes', () => {
		expect(NETWORK_DISCONNECTION_ERRORS.has('net::ERR_NAME_NOT_RESOLVED')).toBe(false);
		expect(NETWORK_DISCONNECTION_ERRORS.has('net::ERR_CERT_COMMON_NAME_INVALID')).toBe(
			false,
		);
		expect(NETWORK_DISCONNECTION_ERRORS.has('net::ERR_ABORTED')).toBe(false);
	});
});

describe('findDisconnectionFailures', () => {
	it('returns empty array when no failed requests', () => {
		expect(findDisconnectionFailures([])).toStrictEqual([]);
	});

	it('returns empty array when failures are not network disconnection errors', () => {
		const failures = [
			{ url: 'https://example.com/style.css', errorText: 'net::ERR_ABORTED' },
			{ url: 'https://example.com/script.js', errorText: 'net::ERR_NAME_NOT_RESOLVED' },
		];
		expect(findDisconnectionFailures(failures)).toStrictEqual([]);
	});

	it('returns only disconnection failures from mixed failures', () => {
		const failures = [
			{ url: 'https://example.com/style.css', errorText: 'net::ERR_ABORTED' },
			{
				url: 'https://example.com/font.woff2',
				errorText: 'net::ERR_INTERNET_DISCONNECTED',
			},
			{ url: 'https://example.com/script.js', errorText: 'net::ERR_CONNECTION_RESET' },
			{ url: 'https://example.com/image.png', errorText: 'net::ERR_FAILED' },
		];
		const result = findDisconnectionFailures(failures);
		expect(result).toStrictEqual([
			{
				url: 'https://example.com/font.woff2',
				errorText: 'net::ERR_INTERNET_DISCONNECTED',
			},
			{ url: 'https://example.com/script.js', errorText: 'net::ERR_CONNECTION_RESET' },
		]);
	});

	it('returns all failures when all are disconnection errors', () => {
		const failures = [
			{ url: 'https://example.com/a.js', errorText: 'net::ERR_NETWORK_CHANGED' },
			{ url: 'https://example.com/b.css', errorText: 'net::ERR_CONNECTION_TIMED_OUT' },
			{ url: 'https://example.com/c.png', errorText: 'net::ERR_NETWORK_IO_SUSPENDED' },
		];
		const result = findDisconnectionFailures(failures);
		expect(result).toHaveLength(3);
	});
});
