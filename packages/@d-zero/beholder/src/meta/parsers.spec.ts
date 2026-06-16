import { describe, expect, it } from 'vitest';

import {
	capJsonLdContent,
	JSON_LD_PER_ENTRY_LIMIT,
	normalizeValue,
	parseFormatDetection,
	parseJsonLd,
	parseRefresh,
	parseReferrer,
	parseRobots,
	parseViewport,
} from './parsers.js';

describe('parseViewport', () => {
	it('parses width=device-width and initial-scale', () => {
		const result = parseViewport('width=device-width, initial-scale=1.0');
		expect(result.raw).toBe('width=device-width, initial-scale=1.0');
		expect(result.width).toBe('device-width');
		expect(result.initialScale).toBe(1);
	});

	it('parses user-scalable=no as boolean false', () => {
		const result = parseViewport('user-scalable=no');
		expect(result.userScalable).toBe(false);
	});

	it('parses minimum-scale/maximum-scale as numbers', () => {
		const result = parseViewport('minimum-scale=0.5, maximum-scale=2');
		expect(result.minimumScale).toBe(0.5);
		expect(result.maximumScale).toBe(2);
	});

	it('preserves viewport-fit and interactive-widget literally', () => {
		const result = parseViewport('viewport-fit=cover, interactive-widget=resizes-visual');
		expect(result.viewportFit).toBe('cover');
		expect(result.interactiveWidget).toBe('resizes-visual');
	});

	it('keeps raw on unrecognizable input', () => {
		const result = parseViewport('garbage');
		expect(result.raw).toBe('garbage');
		expect(result.width).toBeUndefined();
	});
});

describe('parseRobots', () => {
	it('flags noindex/nofollow/noarchive', () => {
		const result = parseRobots('noindex, NOFOLLOW, noarchive');
		expect(result.noindex).toBe(true);
		expect(result.nofollow).toBe(true);
		expect(result.noarchive).toBe(true);
	});

	it('extracts max-snippet, max-image-preview, max-video-preview', () => {
		const result = parseRobots(
			'max-snippet:50, max-image-preview:large, max-video-preview:120',
		);
		expect(result.maxSnippet).toBe(50);
		expect(result.maxImagePreview).toBe('large');
		expect(result.maxVideoPreview).toBe(120);
	});

	it('extracts unavailable_after', () => {
		const result = parseRobots('unavailable_after:2026-12-31');
		expect(result.unavailableAfter).toBe('2026-12-31');
	});

	it('flags index/follow positives', () => {
		const result = parseRobots('index, follow');
		expect(result.index).toBe(true);
		expect(result.follow).toBe(true);
	});
});

describe('parseReferrer', () => {
	it('flags strict-origin-when-cross-origin', () => {
		const result = parseReferrer('strict-origin-when-cross-origin');
		expect(result.strictOriginWhenCrossOrigin).toBe(true);
	});

	it('flags no-referrer', () => {
		const result = parseReferrer('no-referrer');
		expect(result.noReferrer).toBe(true);
	});
});

describe('parseFormatDetection', () => {
	it('parses telephone=no, address=no', () => {
		const result = parseFormatDetection('telephone=no, address=no');
		expect(result.telephone).toBe(false);
		expect(result.address).toBe(false);
	});

	it('parses date=no via semicolon separator', () => {
		const result = parseFormatDetection('telephone=no; date=no');
		expect(result.telephone).toBe(false);
		expect(result.date).toBe(false);
	});
});

describe('parseRefresh', () => {
	it('parses seconds and url', () => {
		const result = parseRefresh('5; url=https://example.com/');
		expect(result.seconds).toBe(5);
		expect(result.url).toBe('https://example.com/');
	});

	it('handles missing url', () => {
		const result = parseRefresh('30');
		expect(result.seconds).toBe(30);
		expect(result.url).toBeUndefined();
	});

	it('strips surrounding quotes in url', () => {
		const result = parseRefresh(`0; url='https://example.com/'`);
		expect(result.url).toBe('https://example.com/');
	});
});

describe('parseJsonLd', () => {
	it('returns parsed object on valid JSON', () => {
		const entry = parseJsonLd('{"@type":"WebSite","name":"Site"}');
		expect(entry.parsed).toEqual({ '@type': 'WebSite', name: 'Site' });
		expect(entry.parseError).toBeUndefined();
	});

	it('records parseError on invalid JSON', () => {
		const entry = parseJsonLd('{ not valid }');
		expect(entry.parsed).toBeUndefined();
		expect(entry.parseError).toBeDefined();
	});
});

describe('normalizeValue', () => {
	it('passes through string by default', () => {
		expect(normalizeValue('hello')).toBe('hello');
		expect(normalizeValue('hello', 'string')).toBe('hello');
	});

	it('boolean-yes maps yes/no', () => {
		expect(normalizeValue('yes', 'boolean-yes')).toBe(true);
		expect(normalizeValue('no', 'boolean-yes')).toBe(false);
		expect(normalizeValue('unknown', 'boolean-yes')).toBe('unknown');
	});

	it('boolean-on maps on/off/true/false/1/0', () => {
		expect(normalizeValue('on', 'boolean-on')).toBe(true);
		expect(normalizeValue('off', 'boolean-on')).toBe(false);
		expect(normalizeValue('true', 'boolean-on')).toBe(true);
		expect(normalizeValue('0', 'boolean-on')).toBe(false);
	});

	it('boolean-true maps true/false only', () => {
		expect(normalizeValue('true', 'boolean-true')).toBe(true);
		expect(normalizeValue('false', 'boolean-true')).toBe(false);
		expect(normalizeValue('1', 'boolean-true')).toBe('1');
	});

	it('number parses floats and falls back to raw', () => {
		expect(normalizeValue('3.14', 'number')).toBe(3.14);
		expect(normalizeValue('NaN-ish', 'number')).toBe('NaN-ish');
	});
});

describe('capJsonLdContent', () => {
	it('returns content unchanged when under the limit', () => {
		const result = capJsonLdContent('{}');
		expect(result).toEqual({ content: '{}', truncated: false });
	});

	it('truncates content over the per-entry limit', () => {
		const big = 'a'.repeat(JSON_LD_PER_ENTRY_LIMIT + 100);
		const result = capJsonLdContent(big);
		expect(result.truncated).toBe(true);
		expect(result.content.length).toBe(JSON_LD_PER_ENTRY_LIMIT);
	});
});
