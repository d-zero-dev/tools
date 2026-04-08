import { describe, expect, test } from 'vitest';

import { mimeToExtension } from './mime-to-extension.js';

describe('mimeToExtension', () => {
	test('returns empty string for undefined', () => {
		expect(mimeToExtension()).toBe('');
	});

	test('returns empty string for empty string', () => {
		expect(mimeToExtension('')).toBe('');
	});

	test('returns empty string for unknown MIME type', () => {
		expect(mimeToExtension('unknown/type')).toBe('');
	});

	test('handles MIME type with charset parameter', () => {
		expect(mimeToExtension('text/html; charset=utf-8')).toBe('.html');
		expect(mimeToExtension('text/css; charset=UTF-8')).toBe('.css');
		expect(mimeToExtension('application/javascript; charset=utf-8')).toBe('.js');
	});

	test('handles MIME type without parameters', () => {
		expect(mimeToExtension('text/html')).toBe('.html');
		expect(mimeToExtension('text/css')).toBe('.css');
		expect(mimeToExtension('application/javascript')).toBe('.js');
		expect(mimeToExtension('text/javascript')).toBe('.js');
	});

	test('handles image MIME types', () => {
		expect(mimeToExtension('image/jpeg')).toBe('.jpg');
		expect(mimeToExtension('image/png')).toBe('.png');
		expect(mimeToExtension('image/svg+xml')).toBe('.svg');
		expect(mimeToExtension('image/webp')).toBe('.webp');
		expect(mimeToExtension('image/gif')).toBe('.gif');
		expect(mimeToExtension('image/x-icon')).toBe('.ico');
	});

	test('handles font MIME types', () => {
		expect(mimeToExtension('font/woff')).toBe('.woff');
		expect(mimeToExtension('application/font-woff')).toBe('.woff');
		expect(mimeToExtension('font/woff2')).toBe('.woff2');
		expect(mimeToExtension('font/ttf')).toBe('.ttf');
		expect(mimeToExtension('application/x-font-ttf')).toBe('.ttf');
		expect(mimeToExtension('font/otf')).toBe('.otf');
		expect(mimeToExtension('application/x-font-otf')).toBe('.otf');
	});

	test('handles application MIME types', () => {
		expect(mimeToExtension('application/json')).toBe('.json');
		expect(mimeToExtension('application/xml')).toBe('.xml');
		expect(mimeToExtension('text/xml')).toBe('.xml');
	});

	test('is case-insensitive', () => {
		expect(mimeToExtension('TEXT/HTML')).toBe('.html');
		expect(mimeToExtension('Image/PNG')).toBe('.png');
	});

	test('handles whitespace', () => {
		expect(mimeToExtension('  text/html  ')).toBe('.html');
		expect(mimeToExtension('text/css  ; charset=utf-8')).toBe('.css');
	});
});
