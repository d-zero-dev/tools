import { describe, expect, test } from 'vitest';

import { detectCompress } from './detect-compress.js';

describe('detectCompress', () => {
	test('returns false when no content-encoding header', () => {
		expect(detectCompress({})).toBe(false);
	});

	test('returns false when content-encoding is undefined', () => {
		expect(detectCompress({ 'content-encoding': undefined })).toBe(false);
	});

	test('returns false when content-encoding is empty string', () => {
		expect(detectCompress({ 'content-encoding': '' })).toBe(false);
	});

	test('detects gzip', () => {
		expect(detectCompress({ 'content-encoding': 'gzip' })).toBe('gzip');
	});

	test('detects gzip case-insensitive', () => {
		expect(detectCompress({ 'content-encoding': 'GZIP' })).toBe('gzip');
	});

	test('detects br', () => {
		expect(detectCompress({ 'content-encoding': 'br' })).toBe('br');
	});

	test('detects compress', () => {
		expect(detectCompress({ 'content-encoding': 'compress' })).toBe('compress');
	});

	test('detects deflate', () => {
		expect(detectCompress({ 'content-encoding': 'deflate' })).toBe('deflate');
	});

	test('detects sdch', () => {
		expect(detectCompress({ 'content-encoding': 'sdch' })).toBe('sdch');
	});

	test('detects vcdiff', () => {
		expect(detectCompress({ 'content-encoding': 'vcdiff' })).toBe('vcdiff');
	});

	test('detects xdelta', () => {
		expect(detectCompress({ 'content-encoding': 'xdelta' })).toBe('xdelta');
	});

	test('handles string array by joining', () => {
		expect(detectCompress({ 'content-encoding': ['gzip', 'deflate'] })).toBe('gzip');
	});

	test('returns false for unknown encoding', () => {
		expect(detectCompress({ 'content-encoding': 'identity' })).toBe(false);
	});
});
