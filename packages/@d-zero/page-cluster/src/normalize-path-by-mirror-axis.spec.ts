import type { MirrorAxis } from './detect-mirror-axis.js';

import { describe, expect, test } from 'vitest';

import { normalizePathByMirrorAxis } from './normalize-path-by-mirror-axis.js';

const axis: MirrorAxis = { position: 0, values: new Set(['en', 'zh']) };

describe('normalizePathByMirrorAxis', () => {
	test('replaces the axis segment with a placeholder when it matches an axis value', () => {
		expect(normalizePathByMirrorAxis(['en', 'faq', 'index.html'], axis)).toBe(
			'{axis}/faq/index.html',
		);
	});

	test('two mirrors of the same page normalize to the same shape', () => {
		const en = normalizePathByMirrorAxis(['en', 'faq', 'index.html'], axis);
		const zh = normalizePathByMirrorAxis(['zh', 'faq', 'index.html'], axis);
		expect(en).toBe(zh);
	});

	test('leaves the segment untouched when it is not one of the axis values', () => {
		expect(normalizePathByMirrorAxis(['other', 'faq', 'index.html'], axis)).toBe(
			'other/faq/index.html',
		);
	});

	test('leaves segments at other positions untouched even if they happen to match an axis value', () => {
		// 'en' at position 1 is not the axis position, so it stays as-is.
		const axisAtZero: MirrorAxis = { position: 0, values: new Set(['en', 'zh']) };
		expect(normalizePathByMirrorAxis(['other', 'en', 'index.html'], axisAtZero)).toBe(
			'other/en/index.html',
		);
	});

	test('handles a path shorter than the axis position', () => {
		expect(
			normalizePathByMirrorAxis(['only'], { position: 2, values: new Set(['en']) }),
		).toBe('only');
	});
});
