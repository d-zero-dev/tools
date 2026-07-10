import type { CrossBlockUnit } from './merge-cross-block-clusters.js';

import { describe, expect, test } from 'vitest';

import { mergeCrossBlockClusters } from './merge-cross-block-clusters.js';

const noLandmarks = { header: null, nav: null, footer: null, remainderHtml: '' };

describe('mergeCrossBlockClusters', () => {
	test('empty input returns empty map', () => {
		expect(mergeCrossBlockClusters([], {})).toEqual(new Map());
	});

	test('single unit maps to itself', () => {
		const unit: CrossBlockUnit = {
			key: 'k1',
			memberTokenSets: [new Set(['body>main>.card'])],
			memberLandmarks: [noLandmarks],
		};
		const result = mergeCrossBlockClusters([unit], {});
		expect(result.get('k1')).toBe('k1');
	});

	test('two units with identical token sets merge into one', () => {
		const tokens = new Set(['body>main>.card', 'body>main>.title', 'body>main>.body']);
		const unit1: CrossBlockUnit = {
			key: 'k1',
			memberTokenSets: [tokens],
			memberLandmarks: [noLandmarks],
		};
		const unit2: CrossBlockUnit = {
			key: 'k2',
			memberTokenSets: [tokens],
			memberLandmarks: [noLandmarks],
		};
		const result = mergeCrossBlockClusters([unit1, unit2], {});
		expect(result.get('k1')).toBe(result.get('k2'));
	});

	test('two units with disjoint token sets stay separate', () => {
		const unit1: CrossBlockUnit = {
			key: 'k1',
			memberTokenSets: [
				new Set(['body>main>article', 'body>main>article>h1', 'body>main>article>p']),
			],
			memberLandmarks: [noLandmarks],
		};
		const unit2: CrossBlockUnit = {
			key: 'k2',
			memberTokenSets: [
				new Set(['body>aside>section', 'body>aside>section>ul', 'body>footer>nav']),
			],
			memberLandmarks: [noLandmarks],
		};
		const result = mergeCrossBlockClusters([unit1, unit2], {});
		expect(result.get('k1')).toBe('k1');
		expect(result.get('k2')).toBe('k2');
	});

	test('multi-page units with same shape but different class names merge via shape-Jaccard', () => {
		// Two 2-page units: structurally identical skeleton, different BEM class names.
		// Class-name Jaccard = 0; shape Jaccard = 1.0 → should merge.
		const unit1: CrossBlockUnit = {
			key: 'reports',
			memberTokenSets: [
				new Set([
					'body>main>section.c-reports',
					'body>main>section.c-reports>ul.c-reports__list',
				]),
				new Set([
					'body>main>section.c-reports',
					'body>main>section.c-reports>ul.c-reports__list',
				]),
			],
			memberLandmarks: [noLandmarks, noLandmarks],
		};
		const unit2: CrossBlockUnit = {
			key: 'projects',
			memberTokenSets: [
				new Set([
					'body>main>section.c-projects',
					'body>main>section.c-projects>ul.c-projects__list',
				]),
				new Set([
					'body>main>section.c-projects',
					'body>main>section.c-projects>ul.c-projects__list',
				]),
			],
			memberLandmarks: [noLandmarks, noLandmarks],
		};
		const result = mergeCrossBlockClusters([unit1, unit2], {});
		expect(result.get('reports')).toBe(result.get('projects'));
	});

	test('single-page units are excluded from shape-Jaccard comparison', () => {
		// Two 1-page units with same skeleton but different classes stay separate —
		// SHAPE_MIN_PAGES = 2, so 1-page units never participate in shape merge.
		const unit1: CrossBlockUnit = {
			key: 'solo-a',
			memberTokenSets: [
				new Set(['body>main>section.type-a', 'body>main>section.type-a>p']),
			],
			memberLandmarks: [noLandmarks],
		};
		const unit2: CrossBlockUnit = {
			key: 'solo-b',
			memberTokenSets: [
				new Set(['body>main>section.type-b', 'body>main>section.type-b>p']),
			],
			memberLandmarks: [noLandmarks],
		};
		const result = mergeCrossBlockClusters([unit1, unit2], {});
		expect(result.get('solo-a')).toBe('solo-a');
		expect(result.get('solo-b')).toBe('solo-b');
	});

	test('result map has an entry for every input unit key', () => {
		const unit1: CrossBlockUnit = {
			key: 'a',
			memberTokenSets: [new Set(['x'])],
			memberLandmarks: [noLandmarks],
		};
		const unit2: CrossBlockUnit = {
			key: 'b',
			memberTokenSets: [new Set(['y'])],
			memberLandmarks: [noLandmarks],
		};
		const unit3: CrossBlockUnit = {
			key: 'c',
			memberTokenSets: [new Set(['z'])],
			memberLandmarks: [noLandmarks],
		};
		const result = mergeCrossBlockClusters([unit1, unit2, unit3], {});
		expect(result.has('a')).toBe(true);
		expect(result.has('b')).toBe(true);
		expect(result.has('c')).toBe(true);
	});

	test('result is deterministic: same input twice produces identical output', () => {
		const tokens = new Set(['body>main>.card', 'body>main>.title']);
		const unit1: CrossBlockUnit = {
			key: 'k1',
			memberTokenSets: [tokens],
			memberLandmarks: [noLandmarks],
		};
		const unit2: CrossBlockUnit = {
			key: 'k2',
			memberTokenSets: [tokens],
			memberLandmarks: [noLandmarks],
		};
		const r1 = mergeCrossBlockClusters([unit1, unit2], {});
		const r2 = mergeCrossBlockClusters([unit1, unit2], {});
		expect(r1.get('k1')).toBe(r2.get('k1'));
		expect(r1.get('k2')).toBe(r2.get('k2'));
	});

	test('merged result preserves an existing unit key (no freshly invented key)', () => {
		const tokens = new Set(['body>main>.card', 'body>main>.title', 'body>main>.meta']);
		const unit1: CrossBlockUnit = {
			key: 'block-a',
			memberTokenSets: [tokens],
			memberLandmarks: [noLandmarks],
		};
		const unit2: CrossBlockUnit = {
			key: 'block-b',
			memberTokenSets: [tokens],
			memberLandmarks: [noLandmarks],
		};
		const result = mergeCrossBlockClusters([unit1, unit2], {});
		const rootKey = result.get('block-a')!;
		expect(rootKey === 'block-a' || rootKey === 'block-b').toBe(true);
	});

	test('units with landmarks merge when shells also match', () => {
		// Both units have the same landmark header → shell corroboration passes
		const landmarks = {
			header: '<header><nav class="c-global-nav"><a>Home</a></nav></header>',
			nav: null,
			footer: null,
			remainderHtml: '',
		};
		const tokens = new Set(['body>main>.content']);
		const unit1: CrossBlockUnit = {
			key: 'l1',
			memberTokenSets: [tokens],
			memberLandmarks: [landmarks],
		};
		const unit2: CrossBlockUnit = {
			key: 'l2',
			memberTokenSets: [tokens],
			memberLandmarks: [landmarks],
		};
		const result = mergeCrossBlockClusters([unit1, unit2], {});
		expect(result.get('l1')).toBe(result.get('l2'));
	});
});
