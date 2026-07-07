import { describe, expect, test } from 'vitest';

import {
	mergeLandmarkAffinedClusters,
	validateMergeLandmarkAffinedClustersOptions,
} from './merge-landmark-affined-clusters.js';

/**
 * Builds a `<header>`/`<footer>`/`<nav>` fragment whose structural signature
 * is driven entirely by `variant` (a distinct child element class), never by
 * text — `tokenize()` discards visible text (see its own JSDoc), so two
 * fragments distinguished only by text would tokenize identically and
 * silently collapse into the same landmark variant. Same `variant` always
 * produces the same signature; different `variant` values always produce
 * different signatures.
 * @param tag
 * @param variant
 */
function landmark(tag: 'aside' | 'footer' | 'header' | 'nav', variant: string): string {
	return `<${tag}><i class="variant-${variant}"></i></${tag}>`;
}

describe('mergeLandmarkAffinedClusters', () => {
	test('an empty input returns an empty array', () => {
		expect(mergeLandmarkAffinedClusters([], [], [])).toEqual([]);
	});

	test('matches the exact output documented in the JSDoc @example', () => {
		// Kept in sync with mergeLandmarkAffinedClusters's @example: if this
		// ever fails, the JSDoc example is out of date and must be corrected
		// alongside the implementation, not the other way around.
		const result = mergeLandmarkAffinedClusters(
			['["css:a", "cluster:0"]', '["css:b", "cluster:0"]', 'path:other'],
			[
				{ header: '<header><i class="mark-a"></i></header>', remainderHtml: '' },
				{ header: '<header><i class="mark-a"></i></header>', remainderHtml: '' },
				{ header: '<header><b class="mark-b"></b></header>', remainderHtml: '' },
			],
			[new Set(['a', 'b']), new Set(['a', 'c']), new Set(['z'])],
			{ landmarkRarityThreshold: 0.7, landmarkGateSimilarityThreshold: 0.3 },
		);

		expect(result[0]).toBe(result[1]);
		expect(result[0]).toMatch(/^landmark-merge:/);
		expect(result[2]).toBe('path:other');
	});

	test('a landmark shared by every page is never "rare", even at the most permissive threshold — regression test for the withdrawn prototype\'s over-merging failure', () => {
		// The withdrawn earlier prototype of this mechanism merged clusters
		// whenever landmarks matched, full stop — and on real crawl data,
		// header/footer/nav matched on 99%+ of pages, so nearly every pair
		// qualified. This pins that a landmark used by literally every
		// compared page (ratio 1.0) can never be "rare" — the check is a
		// strict `<`, so even the loosest legal threshold (1) rejects it.
		const sharedHeader = { header: landmark('header', 'shared'), remainderHtml: '' };
		const identicalContent = new Set(['a', 'b', 'c']);

		const result = mergeLandmarkAffinedClusters(
			['clusterA', 'clusterB'],
			[sharedHeader, sharedHeader],
			[identicalContent, identicalContent],
			{ landmarkRarityThreshold: 1 },
		);

		expect(result).toEqual(['clusterA', 'clusterB']);
	});

	test('a rare, identical header lets two otherwise-distinct clusters merge once their content clears the looser gate threshold', () => {
		// 41 pages: 2 share a header variant used by no one else (2/41 ≈
		// 0.0488, under the default 0.05 rarity threshold); the other 39
		// share one common, unrelated header (also exercises bucketing many
		// structurally-identical landmark fragments into a single variant at
		// once). The two rare-header pages' content is deliberately below
		// the primary similarityThreshold (0.8) but above the default
		// landmarkGateSimilarityThreshold (0.6): shared = 13 tokens, unique
		// 4/3 tokens -> intersection 13, union 20, jaccard = 0.65.
		const rareHeader = { header: landmark('header', 'rare'), remainderHtml: '' };
		const commonHeader = { header: landmark('header', 'common'), remainderHtml: '' };
		const shared = Array.from({ length: 13 }, (_, i) => `shared-${i}`);
		const contentA = new Set([...shared, 'a1', 'a2', 'a3', 'a4']);
		const contentB = new Set([...shared, 'b1', 'b2', 'b3']);
		expect(
			[...contentA].filter((token) => contentB.has(token)).length /
				new Set([...contentA, ...contentB]).size,
		).toBeCloseTo(0.65);

		const clusterKeys = [
			'clusterA',
			'clusterB',
			...Array.from({ length: 39 }, (_, i) => `filler-${i}`),
		];
		const landmarks = [
			rareHeader,
			rareHeader,
			...Array.from({ length: 39 }, () => commonHeader),
		];
		const contentTokenSets = [
			contentA,
			contentB,
			...Array.from({ length: 39 }, () => new Set(['z'])),
		];

		const result = mergeLandmarkAffinedClusters(clusterKeys, landmarks, contentTokenSets);

		expect(result[0]).toBe(result[1]);
		expect(result[0]).toMatch(/^landmark-merge:/);
	});

	test('two structurally similar (not byte-identical) headers are recognized as the same rare variant via fuzzy matching, not just exact-token-set deduplication', () => {
		// 9 shared child elements + 1 differing one per page: jaccard = 9/11
		// ≈ 0.818, above the default 0.8 similarityThreshold used for
		// landmark-variant identity. These two headers are NOT byte-for-byte
		// identical after tokenization, so exact-match bucketing alone would
		// treat them as two separate, singleton-frequency variants with two
		// different signature strings — which could never land in the same
		// pageIndicesBySignature group, so no merge could ever happen
		// regardless of how rare each individually is. A merge below can
		// only happen if computeLandmarkStatus's fuzzy complete-linkage step
		// actually unified them into one variant label first.
		/**
		 * Builds a header sharing 9 of its 10 children with any other call, differing only in `suffix`.
		 * @param suffix
		 */
		function similarHeader(suffix: string) {
			const shared = Array.from({ length: 9 }, (_, i) => `<i class="s-${i}"></i>`).join(
				'',
			);
			return {
				header: `<header>${shared}<i class="only-${suffix}"></i></header>`,
				remainderHtml: '',
			};
		}
		const commonHeader = { header: landmark('header', 'common'), remainderHtml: '' };
		const pages = [
			{
				clusterKey: 'clusterA',
				landmark: similarHeader('a'),
				content: new Set(['shared-1', 'shared-2']),
			},
			{
				clusterKey: 'clusterB',
				landmark: similarHeader('b'),
				content: new Set(['shared-1', 'shared-2', 'shared-3']),
			},
			...Array.from({ length: 18 }, (_, i) => ({
				clusterKey: `filler-${i}`,
				landmark: commonHeader,
				content: new Set(['z']),
			})),
		];

		const result = mergeLandmarkAffinedClusters(
			pages.map((p) => p.clusterKey),
			pages.map((p) => p.landmark),
			pages.map((p) => p.content),
			{ landmarkRarityThreshold: 0.15 },
		);

		expect(result[0]).toBe(result[1]);
		expect(result[0]).toMatch(/^landmark-merge:/);
	});

	test('a page whose existing landmarks are a mix of rare and common contributes no evidence at all (the most conservative match rule)', () => {
		// Header is rare (shared by exactly 2/10 pages, under the 0.25
		// threshold used here) but footer is common to all 10 — the most
		// conservative rule (every *existing* type must be rare) means the
		// common footer disqualifies the page entirely, even though its
		// header alone would have qualified.
		const rareHeader = landmark('header', 'rare');
		const commonFooter = landmark('footer', 'common');
		const pages = Array.from({ length: 10 }, (_, i) => ({
			clusterKey: i < 2 ? `cluster-${i}` : `filler-${i}`,
			landmark: {
				header: i < 2 ? rareHeader : landmark('header', `filler-${i}`),
				footer: commonFooter,
				remainderHtml: '',
			},
			content: new Set(['shared-a', 'shared-b', 'shared-c']),
		}));

		const result = mergeLandmarkAffinedClusters(
			pages.map((p) => p.clusterKey),
			pages.map((p) => p.landmark),
			pages.map((p) => p.content),
			{ landmarkRarityThreshold: 0.25 },
		);

		expect(result[0]).not.toBe(result[1]);
	});

	test('two pages sharing an identical rare header, but differing in whether a nav is present, do not merge', () => {
		// Presence must match too, not just the variant: page 0 has a rare
		// nav in addition to the rare header, page 1 has no nav at all — their
		// signatures differ even though both share the exact same header.
		const rareHeader = landmark('header', 'rare');
		const rareNav = landmark('nav', 'rare');
		const pages = Array.from({ length: 25 }, (_, i) => {
			if (i === 0) {
				return {
					clusterKey: 'clusterA',
					landmark: { header: rareHeader, nav: rareNav, remainderHtml: '' },
				};
			}
			if (i === 1) {
				return {
					clusterKey: 'clusterB',
					landmark: { header: rareHeader, remainderHtml: '' },
				};
			}
			return {
				clusterKey: `filler-${i}`,
				landmark: { header: landmark('header', `filler-${i}`), remainderHtml: '' },
			};
		});

		const result = mergeLandmarkAffinedClusters(
			pages.map((p) => p.clusterKey),
			pages.map((p) => p.landmark),
			pages.map(() => new Set(['a', 'b', 'c'])),
			{ landmarkRarityThreshold: 0.1 },
		);

		expect(result[0]).not.toBe(result[1]);
	});

	test('a page with no landmarks at all contributes no evidence and is never merged, even when its content is identical to another such page', () => {
		const noLandmarks = { remainderHtml: '' };
		const identicalContent = new Set(['x']);

		const result = mergeLandmarkAffinedClusters(
			['clusterA', 'clusterB'],
			[noLandmarks, noLandmarks],
			[identicalContent, identicalContent],
		);

		expect(result).toEqual(['clusterA', 'clusterB']);
	});

	test('the gated merge is complete-linkage, not single-linkage: a bridge cluster does not transitively merge two others that are dissimilar to each other', () => {
		// Same similarity shape as resolve-structural-cluster-keys.spec.ts's
		// own "refuses to chain A into C through a shared bridge B" test:
		// sim(A,B) ≈ 0.667, sim(B,C) = 0.5, sim(A,C) = 0.25. All three share
		// one rare header (3/10 = 0.3, rare at the 0.5 threshold used here);
		// 7 filler pages share a different, common header (7/10 = 0.7, not
		// rare at 0.5) so they contribute no competing evidence.
		const rareHeader = { header: landmark('header', 'rare'), remainderHtml: '' };
		const commonHeader = { header: landmark('header', 'common'), remainderHtml: '' };
		const pages = [
			{ clusterKey: 'clusterA', landmark: rareHeader, content: new Set(['a', 'b']) },
			{ clusterKey: 'clusterB', landmark: rareHeader, content: new Set(['a', 'b', 'c']) },
			{ clusterKey: 'clusterC', landmark: rareHeader, content: new Set(['a', 'c', 'd']) },
			...Array.from({ length: 7 }, (_, i) => ({
				clusterKey: `filler-${i}`,
				landmark: commonHeader,
				content: new Set(['z']),
			})),
		];

		const result = mergeLandmarkAffinedClusters(
			pages.map((p) => p.clusterKey),
			pages.map((p) => p.landmark),
			pages.map((p) => p.content),
			{ landmarkRarityThreshold: 0.5, landmarkGateSimilarityThreshold: 0.5 },
		);

		expect(result[0]).toBe(result[1]);
		expect(result[2]).not.toBe(result[0]);
	});

	test('a signature group whose pages already share one cluster key is left unchanged (no-op)', () => {
		const rareHeader = { header: landmark('header', 'rare'), remainderHtml: '' };
		const pages = [
			{ clusterKey: 'sameCluster', landmark: rareHeader, content: new Set(['a']) },
			{ clusterKey: 'sameCluster', landmark: rareHeader, content: new Set(['b']) },
			...Array.from({ length: 18 }, (_, i) => ({
				clusterKey: `filler-${i}`,
				landmark: { header: landmark('header', `filler-${i}`), remainderHtml: '' },
				content: new Set(['z']),
			})),
		];

		const result = mergeLandmarkAffinedClusters(
			pages.map((p) => p.clusterKey),
			pages.map((p) => p.landmark),
			pages.map((p) => p.content),
			{ landmarkRarityThreshold: 0.15 },
		);

		expect(result[0]).toBe('sameCluster');
		expect(result[1]).toBe('sameCluster');
	});

	test("a merge decision drawn from a small subset of two clusters' pages only re-keys those specific pages, not every page sharing the original cluster key (regression test for whole-cluster over-application of partial evidence)", () => {
		// Only page 0 of clusterA and page 0 of clusterB carry the rare
		// header and have content similar enough to clear the gate; the
		// other 4 pages of each cluster have a common header and content
		// disjoint from everything else. A correct implementation merges
		// only the two evidence pages — not clusterA/clusterB's remaining 8
		// pages, which never supplied any evidence at all.
		const rareHeader = { header: landmark('header', 'rare'), remainderHtml: '' };
		const otherHeader = { header: landmark('header', 'other'), remainderHtml: '' };

		const clusterAPages = Array.from({ length: 5 }, (_, i) => ({
			clusterKey: 'clusterA',
			landmark: i === 0 ? rareHeader : otherHeader,
			content: i === 0 ? new Set(['shared-1', 'shared-2']) : new Set([`a-only-${i}`]),
		}));
		const clusterBPages = Array.from({ length: 5 }, (_, i) => ({
			clusterKey: 'clusterB',
			landmark: i === 0 ? rareHeader : otherHeader,
			content:
				i === 0
					? new Set(['shared-1', 'shared-2', 'shared-3'])
					: new Set([`b-only-${i}`]),
		}));
		const fillers = Array.from({ length: 8 }, (_, i) => ({
			clusterKey: `filler-${i}`,
			landmark: otherHeader,
			content: new Set([`filler-${i}`]),
		}));
		const pages = [...clusterAPages, ...clusterBPages, ...fillers];

		const result = mergeLandmarkAffinedClusters(
			pages.map((p) => p.clusterKey),
			pages.map((p) => p.landmark),
			pages.map((p) => p.content),
			{ landmarkRarityThreshold: 0.15 },
		);

		expect(result[0]).toBe(result[5]);
		expect(result[0]).toMatch(/^landmark-merge:/);
		for (let i = 1; i < 5; i++) {
			expect(result[i]).toBe('clusterA');
		}
		for (let i = 1; i < 5; i++) {
			expect(result[5 + i]).toBe('clusterB');
		}
	});

	test('validates its own options eagerly, even when called directly with non-empty input (not only reachable via a separate validate call)', () => {
		expect(() =>
			mergeLandmarkAffinedClusters(
				['clusterA', 'clusterB'],
				[{ remainderHtml: '' }, { remainderHtml: '' }],
				[new Set(['a']), new Set(['a'])],
				{ landmarkGateSimilarityThreshold: Number.NaN },
			),
		).toThrow(RangeError);
	});

	test('landmarkRarityThreshold controls the cutoff: a 6%-frequency variant is not rare at the default 5% but is at 10%', () => {
		const rareHeader = { header: landmark('header', 'six-percent'), remainderHtml: '' };
		const commonHeader = {
			header: landmark('header', 'ninety-four-percent'),
			remainderHtml: '',
		};
		const shared = Array.from({ length: 13 }, (_, i) => `shared-${i}`);
		const contentA = new Set([...shared, 'a1', 'a2', 'a3', 'a4']);
		const contentB = new Set([...shared, 'b1', 'b2', 'b3']);

		const pages = [
			{ clusterKey: 'clusterA', landmark: rareHeader, content: contentA },
			{ clusterKey: 'clusterB', landmark: rareHeader, content: contentB },
			...Array.from({ length: 4 }, (_, i) => ({
				clusterKey: `rare-filler-${i}`,
				landmark: rareHeader,
				content: new Set(['z']),
			})),
			...Array.from({ length: 94 }, (_, i) => ({
				clusterKey: `common-filler-${i}`,
				landmark: commonHeader,
				content: new Set(['z']),
			})),
		];
		expect(pages).toHaveLength(100);

		const atDefaultThreshold = mergeLandmarkAffinedClusters(
			pages.map((p) => p.clusterKey),
			pages.map((p) => p.landmark),
			pages.map((p) => p.content),
		);
		expect(atDefaultThreshold[0]).not.toBe(atDefaultThreshold[1]);

		const atLooserThreshold = mergeLandmarkAffinedClusters(
			pages.map((p) => p.clusterKey),
			pages.map((p) => p.landmark),
			pages.map((p) => p.content),
			{ landmarkRarityThreshold: 0.1 },
		);
		expect(atLooserThreshold[0]).toBe(atLooserThreshold[1]);
	});
});

describe('validateMergeLandmarkAffinedClustersOptions', () => {
	test('accepts no options at all (every default applies)', () => {
		expect(() => validateMergeLandmarkAffinedClustersOptions()).not.toThrow();
	});

	test.each([
		'similarityThreshold',
		'landmarkRarityThreshold',
		'landmarkGateSimilarityThreshold',
	])('rejects %s outside [0, 1]', (field) => {
		for (const value of [-0.1, 1.1, Number.NaN]) {
			expect(() =>
				validateMergeLandmarkAffinedClustersOptions({ [field]: value }),
			).toThrow(RangeError);
		}
	});

	test.each([
		'similarityThreshold',
		'landmarkRarityThreshold',
		'landmarkGateSimilarityThreshold',
	])('accepts %s at the boundary values 0 and 1', (field) => {
		for (const value of [0, 1]) {
			expect(() =>
				validateMergeLandmarkAffinedClustersOptions({ [field]: value }),
			).not.toThrow();
		}
	});
});
