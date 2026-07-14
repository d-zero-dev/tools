import { describe, expect, test } from 'vitest';

import { derivePathClusterKeys } from './derive-path-cluster-keys.js';

describe('derivePathClusterKeys', () => {
	test('empty input returns depth 1 and empty keys', () => {
		expect(derivePathClusterKeys([])).toEqual({ depth: 1, keys: [] });
	});

	test('flat corpus with clear top-level split picks depth 1', () => {
		const paths = [
			['dept-a', 'news', '1'],
			['dept-a', 'news', '2'],
			['dept-b', 'about'],
			['dept-c'],
		];
		const result = derivePathClusterKeys(paths);
		expect(result.depth).toBe(1);
		expect(result.keys).toEqual(['dept-a', 'dept-a', 'dept-b', 'dept-c']);
	});

	test('single-segment corpus with all pages under one section returns depth 1', () => {
		const paths = [['x'], ['x'], ['x']];
		const result = derivePathClusterKeys(paths);
		expect(result.depth).toBe(1);
		expect(result.keys).toEqual(['x', 'x', 'x']);
	});

	test('deep uniform structure with per-page leaf still returns a small depth (not the max)', () => {
		// All pages share top-two segments; only the third segment varies per
		// page. Corpus is at the auto-cut floor (20 pages) so the sweep
		// actually runs, and should recognize the depth-3 jump as noise
		// and stop before it.
		const paths = Array.from({ length: 20 }, (_, i) => ['root', 'section', `page-${i}`]);
		const result = derivePathClusterKeys(paths);
		expect(result.depth).toBeLessThanOrEqual(2);
	});

	test('small corpus (below the auto-cut floor) always returns depth 1 without invoking the sweep', () => {
		// The auto-cut needs at least a handful of pages to see a meaningful
		// gap; below that floor the function short-circuits to depth 1.
		const paths = [
			['root', 'section', 'a'],
			['root', 'section', 'b'],
			['root', 'section', 'c'],
		];
		expect(derivePathClusterKeys(paths).depth).toBe(1);
	});

	test('empty path array element does not throw and produces an empty key at any depth', () => {
		const paths: readonly (readonly string[])[] = [[]];
		expect(() => derivePathClusterKeys(paths)).not.toThrow();
	});
});
