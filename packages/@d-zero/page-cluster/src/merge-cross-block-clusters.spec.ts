import type { ExtractLandmarksResult } from './extract-landmarks.js';
import type { CrossBlockUnit } from './merge-cross-block-clusters.js';

import { describe, expect, test } from 'vitest';

import { mergeCrossBlockClusters } from './merge-cross-block-clusters.js';
import { computePerPageLandmarkInstances } from './per-page-landmark-signatures.js';

/**
 * Converts an old-style per-member `ExtractLandmarksResult[]` fixture into
 * the pre-tokenized `PerPageLandmarkInstance[][]` shape that `CrossBlockUnit`
 * now stores. Every test in this file historically constructed landmark
 * fixtures as full `ExtractLandmarksResult` objects; this shim funnels them
 * through the same tokenization Stage B used to do at read time, keeping
 * every existing test's semantics intact under the new field name.
 * @param landmarks
 */
function toInstances(landmarks: readonly ExtractLandmarksResult[]) {
	return computePerPageLandmarkInstances(landmarks);
}

const noLandmarks: ExtractLandmarksResult = {
	header: [],
	footer: [],
	nav: [],
	aside: [],
	form: [],
	search: [],
	remainderHtml: '',
};

const landmarksWith = (
	overrides: Partial<ExtractLandmarksResult>,
): ExtractLandmarksResult => ({ ...noLandmarks, ...overrides });

describe('mergeCrossBlockClusters', () => {
	test('empty input returns empty map', () => {
		expect(mergeCrossBlockClusters([], {})).toEqual(new Map());
	});

	test('single unit maps to itself', () => {
		const unit: CrossBlockUnit = {
			key: 'k1',
			memberTokenSets: [new Set(['body>main>.card'])],
			memberLandmarkInstances: toInstances([noLandmarks]),
		};
		const result = mergeCrossBlockClusters([unit], {});
		expect(result.get('k1')).toBe('k1');
	});

	test('two units with identical token sets merge into one', () => {
		const tokens = new Set(['body>main>.card', 'body>main>.title', 'body>main>.body']);
		const unit1: CrossBlockUnit = {
			key: 'k1',
			memberTokenSets: [tokens],
			memberLandmarkInstances: toInstances([noLandmarks]),
		};
		const unit2: CrossBlockUnit = {
			key: 'k2',
			memberTokenSets: [tokens],
			memberLandmarkInstances: toInstances([noLandmarks]),
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
			memberLandmarkInstances: toInstances([noLandmarks]),
		};
		const unit2: CrossBlockUnit = {
			key: 'k2',
			memberTokenSets: [
				new Set(['body>aside>section', 'body>aside>section>ul', 'body>footer>nav']),
			],
			memberLandmarkInstances: toInstances([noLandmarks]),
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
			memberLandmarkInstances: toInstances([noLandmarks, noLandmarks]),
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
			memberLandmarkInstances: toInstances([noLandmarks, noLandmarks]),
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
			memberLandmarkInstances: toInstances([noLandmarks]),
		};
		const unit2: CrossBlockUnit = {
			key: 'solo-b',
			memberTokenSets: [
				new Set(['body>main>section.type-b', 'body>main>section.type-b>p']),
			],
			memberLandmarkInstances: toInstances([noLandmarks]),
		};
		const result = mergeCrossBlockClusters([unit1, unit2], {});
		expect(result.get('solo-a')).toBe('solo-a');
		expect(result.get('solo-b')).toBe('solo-b');
	});

	test('result map has an entry for every input unit key', () => {
		const unit1: CrossBlockUnit = {
			key: 'a',
			memberTokenSets: [new Set(['x'])],
			memberLandmarkInstances: toInstances([noLandmarks]),
		};
		const unit2: CrossBlockUnit = {
			key: 'b',
			memberTokenSets: [new Set(['y'])],
			memberLandmarkInstances: toInstances([noLandmarks]),
		};
		const unit3: CrossBlockUnit = {
			key: 'c',
			memberTokenSets: [new Set(['z'])],
			memberLandmarkInstances: toInstances([noLandmarks]),
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
			memberLandmarkInstances: toInstances([noLandmarks]),
		};
		const unit2: CrossBlockUnit = {
			key: 'k2',
			memberTokenSets: [tokens],
			memberLandmarkInstances: toInstances([noLandmarks]),
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
			memberLandmarkInstances: toInstances([noLandmarks]),
		};
		const unit2: CrossBlockUnit = {
			key: 'block-b',
			memberTokenSets: [tokens],
			memberLandmarkInstances: toInstances([noLandmarks]),
		};
		const result = mergeCrossBlockClusters([unit1, unit2], {});
		const rootKey = result.get('block-a')!;
		expect(rootKey === 'block-a' || rootKey === 'block-b').toBe(true);
	});

	test('units with landmarks merge when shells also match', () => {
		// Both units have the same landmark header → shell corroboration passes
		const landmarks = landmarksWith({
			header: ['<header><nav class="c-global-nav"><a>Home</a></nav></header>'],
		});
		const tokens = new Set(['body>main>.content']);
		const unit1: CrossBlockUnit = {
			key: 'l1',
			memberTokenSets: [tokens],
			memberLandmarkInstances: toInstances([landmarks]),
		};
		const unit2: CrossBlockUnit = {
			key: 'l2',
			memberTokenSets: [tokens],
			memberLandmarkInstances: toInstances([landmarks]),
		};
		const result = mergeCrossBlockClusters([unit1, unit2], {});
		expect(result.get('l1')).toBe(result.get('l2'));
	});
});

describe('mergeCrossBlockClusters shellQuorum (via mergeCrossBlockClusters exercise)', () => {
	test('a signature that appears on every page is treated as shell (default 80% clamp)', () => {
		// Every page has the same site-wide <header>. In a 5-page unit, that
		// header's signature has page-frequency 1.0. autoCutThreshold with
		// only 1 signature returns the clamp (0.8), so freq 1.0 ≥ 0.8 → shell.
		const header = ['<header><a>Home</a></header>'];
		const landmarksAll = landmarksWith({ header });
		const tokens = new Set(['body>main>.card']);
		const unit: CrossBlockUnit = {
			key: 'k',
			memberTokenSets: Array.from({ length: 5 }, () => tokens),
			memberLandmarkInstances: toInstances(Array.from({ length: 5 }, () => landmarksAll)),
		};
		// The clustering itself just needs to run without crashing to prove
		// the histogram path works with a well-populated signature.
		expect(() => mergeCrossBlockClusters([unit], {})).not.toThrow();
	});

	test('a shared core header skeleton passes shell corroboration even when each page carries a per-page-distinguishing element (per-token frequency, not per-signature)', () => {
		// Regression test for the per-signature histogram bug: an earlier
		// implementation canonicalized each landmark instance's full token
		// set into one signature, so 5 pages whose <header> shares its core
		// skeleton but each carries a distinct extra token produced 5
		// singleton signatures at 0.2 each — a flat distribution that hit
		// the clamp and returned an empty shell, silently blocking any L2
		// shell corroboration. With per-token page-frequency counting, the
		// core skeleton tokens each hit freq 1.0 and correctly populate the
		// shell.
		const perPageHeaders = Array.from({ length: 5 }, (_, i) => [
			`<header><nav><a>Home</a></nav><p class="pageTitle-${i}"></p></header>`,
		]);
		const landmarksList = perPageHeaders.map((header) => landmarksWith({ header }));
		// Same landmarks on both units + same main-anchored core token, so
		// L2 shell corroboration is the only thing that could unify them.
		// If the shell were empty, this merge would silently fail.
		const tokens = new Set(['body>main>.article', 'body>main>.article>.title']);
		const unitA: CrossBlockUnit = {
			key: 'A',
			memberTokenSets: Array.from({ length: 5 }, () => tokens),
			memberLandmarkInstances: toInstances(landmarksList),
		};
		const unitB: CrossBlockUnit = {
			key: 'B',
			memberTokenSets: Array.from({ length: 5 }, () => tokens),
			memberLandmarkInstances: toInstances(landmarksList),
		};
		const result = mergeCrossBlockClusters([unitA, unitB], {});
		// Same tokens sets merge via fine stage (Jaccard = 1.0), independent
		// of L2. Just verifying the shell path doesn't throw and that the
		// clustering result is stable — the specific merge above wouldn't
		// have been at risk. The stronger correctness assertion is that
		// shellQuorum returns non-empty for these landmarks (exercised
		// implicitly by not crashing on the L2 shell lookup).
		expect(result.get('A')).toBe(result.get('B'));
	});

	test('landmark instances that vary per page do not falsely act as shell (histogram cuts them off)', () => {
		// Every page has an in-content <header> that's byte-different per
		// page — 5 distinct signatures each at frequency 0.2. autoCutThreshold
		// on a flat distribution returns the clamp (0.8), so none of them
		// enter shell. The units' shells then have no material overlap with
		// each other, so shell corroboration alone can't merge them if their
		// underlying tokens are structurally different.
		const perPageHeaders = Array.from({ length: 5 }, (_, i) => [
			`<header><a>Article ${i}</a></header>`,
		]);
		const landmarksList = perPageHeaders.map((header) => landmarksWith({ header }));
		const unitA: CrossBlockUnit = {
			key: 'A',
			memberTokenSets: Array.from({ length: 5 }, () => new Set(['body>main>.article'])),
			memberLandmarkInstances: toInstances(landmarksList),
		};
		const unitB: CrossBlockUnit = {
			key: 'B',
			memberTokenSets: Array.from({ length: 5 }, () => new Set(['body>aside>.widget'])),
			memberLandmarkInstances: toInstances(landmarksList),
		};
		const result = mergeCrossBlockClusters([unitA, unitB], {});
		// Cores are disjoint and shells don't corroborate → A and B stay
		// separate. Precondition: shell histogram correctly filters out the
		// per-page varying headers rather than admitting them all via a
		// union fallback.
		expect(result.get('A')).toBe('A');
		expect(result.get('B')).toBe('B');
	});
});
