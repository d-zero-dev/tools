import { describe, expect, test } from 'vitest';

import { detectMirrorAxis } from './detect-mirror-axis.js';

/**
 * @param axisValues
 * @param sections
 */
function buildMirroredPaths(
	axisValues: readonly string[],
	sections: readonly string[],
): string[][] {
	const paths: string[][] = [];
	for (const axisValue of axisValues) {
		for (const section of sections) paths.push([axisValue, section, 'index.html']);
	}
	return paths;
}

describe('detectMirrorAxis', () => {
	test('finds an axis mirrored across many sections at position 0', () => {
		const paths = buildMirroredPaths(
			['en', 'zh', 'ko', 'th'],
			['faq', 'access', 'gallery', 'search', 'course', 'fare', 'article', 'index'],
		);
		const axis = detectMirrorAxis(paths);
		expect(axis).not.toBeNull();
		expect(axis?.position).toBe(0);
		expect(axis?.values).toEqual(new Set(['en', 'zh', 'ko', 'th']));
	});

	test('returns null for a single-mirror corpus (nothing recurs under alternative values)', () => {
		const paths = [
			['en', 'faq', 'index.html'],
			['en', 'access', 'index.html'],
			['en', 'gallery', 'index.html'],
		];
		expect(detectMirrorAxis(paths)).toBeNull();
	});

	test('does not misidentify a single section of sibling pages as an axis', () => {
		// One section's own sub-pages vary at position 1 — a real value set,
		// but only one skeleton (`faq/*`) ever shows it, so it is coincidence
		// (an ordinary listing), not a recurring mirror.
		const paths = [
			['faq', '01', 'index.html'],
			['faq', '02', 'index.html'],
			['faq', '03', 'index.html'],
		];
		expect(detectMirrorAxis(paths)).toBeNull();
	});

	test('rejects a value set that only recurs across 2 skeletons (below minSkeletonCount)', () => {
		const paths = buildMirroredPaths(['en', 'zh'], ['faq', 'access']);
		expect(detectMirrorAxis(paths)).toBeNull();
	});

	test('accepts a value set recurring across exactly minSkeletonCount skeletons', () => {
		const paths = buildMirroredPaths(['en', 'zh'], ['faq', 'access', 'gallery']);
		const axis = detectMirrorAxis(paths);
		expect(axis?.values).toEqual(new Set(['en', 'zh']));
	});

	test('picks the position with the most recurring skeletons when several qualify', () => {
		// Position 0 (language) recurs across 8 sections; position 2
		// (filename) only recurs across 3 (fewer) — position 0 must win.
		const languageAxis = buildMirroredPaths(
			['en', 'zh', 'ko'],
			['faq', 'access', 'gallery', 'search', 'course', 'fare', 'article', 'index'],
		);
		const filenameNoise = [
			['faq', 'sub', 'a.html'],
			['faq', 'sub', 'b.html'],
			['faq', 'sub', 'c.html'],
		];
		const axis = detectMirrorAxis([...languageAxis, ...filenameNoise]);
		expect(axis?.position).toBe(0);
	});

	test('ignores empty path segments', () => {
		const paths = buildMirroredPaths(
			['en', 'zh', 'ko'],
			['faq', 'access', 'gallery'],
		).map((p) => [...p, '']);
		const axis = detectMirrorAxis(paths);
		expect(axis?.values).toEqual(new Set(['en', 'zh', 'ko']));
	});

	test('returns null for empty input', () => {
		expect(detectMirrorAxis([])).toBeNull();
	});

	test('respects a custom minSkeletonCount', () => {
		const paths = buildMirroredPaths(['en', 'zh'], ['faq', 'access', 'gallery']);
		expect(detectMirrorAxis(paths, { minSkeletonCount: 4 })).toBeNull();
	});

	test('respects a custom maxPosition by not scanning beyond it', () => {
		// Positions 0 and 1 are constant across every page (so they can never
		// produce a candidate regardless of scan range); the only real axis
		// sits at position 2, crossed against an unrelated position-3
		// "distinguisher" purely so position 2's value set recurs across
		// more than one skeleton (`minSkeletonCount`).
		const paths: string[][] = [];
		for (const axisValue of ['en', 'zh', 'ko']) {
			for (const distinguisher of ['d1', 'd2', 'd3']) {
				paths.push(['root', 'sub', axisValue, distinguisher]);
			}
		}
		expect(detectMirrorAxis(paths, { maxPosition: 2 })).toBeNull();
		const axis = detectMirrorAxis(paths, { maxPosition: 3 });
		expect(axis?.position).toBe(2);
		expect(axis?.values).toEqual(new Set(['en', 'zh', 'ko']));
	});
});
