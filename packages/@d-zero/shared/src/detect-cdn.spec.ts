import { describe, expect, test } from 'vitest';

import { detectCDN } from './detect-cdn.js';

describe('detectCDN', () => {
	test('returns false when no CDN headers', () => {
		expect(detectCDN({})).toBe(false);
	});

	test('returns false for unrelated headers', () => {
		expect(detectCDN({ 'content-type': 'text/html' })).toBe(false);
	});

	test('detects Akamai via X-Akamai-Transformed header', () => {
		expect(detectCDN({ 'X-Akamai-Transformed': '9 - 0' })).toBe('Akamai');
	});

	test('detects Akamai via lowercase header', () => {
		expect(detectCDN({ 'x-akamai-transformed': '9 - 0' })).toBe('Akamai');
	});

	test('detects Amazon CloudFront via x-amz-cf-pop header', () => {
		expect(detectCDN({ 'x-amz-cf-pop': 'NRT51-C1' })).toBe('Amazon CloudFront');
	});

	test('detects IIJ via X-IIJ-Cache header', () => {
		expect(detectCDN({ 'X-IIJ-Cache': 'HIT' })).toBe('IIJ');
	});

	test('detects IIJ via lowercase header', () => {
		expect(detectCDN({ 'x-iij-cache': 'HIT' })).toBe('IIJ');
	});

	test('detects Cloudflare via server header', () => {
		expect(detectCDN({ server: 'cloudflare' })).toBe('Cloudflare');
	});

	test('detects Cloudflare case-insensitive', () => {
		expect(detectCDN({ server: 'Cloudflare' })).toBe('Cloudflare');
	});

	test('detects Amazon S3 via server header', () => {
		expect(detectCDN({ server: 'AmazonS3' })).toBe('Amazon S3');
	});

	test('detects Amazon S3 case-insensitive', () => {
		expect(detectCDN({ server: 'amazons3' })).toBe('Amazon S3');
	});

	test('returns false when server header does not match known CDN', () => {
		expect(detectCDN({ server: 'nginx' })).toBe(false);
	});

	test('prioritizes header key check over server value', () => {
		expect(detectCDN({ 'X-Akamai-Transformed': '9 - 0', server: 'cloudflare' })).toBe(
			'Akamai',
		);
	});
});
