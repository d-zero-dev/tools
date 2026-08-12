import type { MirrorAxis } from './detect-mirror-axis.js';

import { describe, expect, test } from 'vitest';

import { normalizeHrefByMirrorAxis } from './normalize-href-by-mirror-axis.js';

const axis: MirrorAxis = { position: 0, values: new Set(['en', 'zh']) };

describe('normalizeHrefByMirrorAxis', () => {
	test('replaces an axis value segment anywhere in the href', () => {
		expect(normalizeHrefByMirrorAxis('https://example.test/en/faq/page.css', axis)).toBe(
			'https://example.test/{axis}/faq/page.css',
		);
	});

	test('two mirrored hrefs normalize to the same shape', () => {
		const en = normalizeHrefByMirrorAxis('https://example.test/en/faq/page.css', axis);
		const zh = normalizeHrefByMirrorAxis('https://example.test/zh/faq/page.css', axis);
		expect(en).toBe(zh);
	});

	test('leaves an href with no axis value untouched', () => {
		const href = 'https://example.test/css/reset.css';
		expect(normalizeHrefByMirrorAxis(href, axis)).toBe(href);
	});

	test('does not touch a substring that merely contains an axis value without slash boundaries', () => {
		// "/length/" contains "en" but not as a `/en/` path segment.
		const href = 'https://example.test/length/page.css';
		expect(normalizeHrefByMirrorAxis(href, axis)).toBe(href);
	});

	test('replaces every occurrence, not just the first', () => {
		const href = 'https://example.test/en/assets/en/page.css';
		expect(normalizeHrefByMirrorAxis(href, axis)).toBe(
			'https://example.test/{axis}/assets/{axis}/page.css',
		);
	});
});
