import type { ClusteredPage } from './find-cross-cluster-duplicates.js';

import { describe, expect, test } from 'vitest';

import { validateClusterPartition } from './validate-cluster-partition.js';

/**
 * @param overrides
 */
function page(overrides: Partial<ClusteredPage>): ClusteredPage {
	return {
		clusterKey: 'k',
		tokens: new Set(),
		paths: [],
		stylesheetHrefs: [],
		...overrides,
	};
}

describe('validateClusterPartition', () => {
	test('detects the mirror axis, reports cohesion per cluster, and finds the split duplicate', () => {
		const shared = new Set(['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9']);
		const faqEn = page({
			clusterKey: 'faq-en-cluster',
			tokens: shared,
			paths: ['en', 'faq', 'index.html'],
			stylesheetHrefs: ['https://example.test/en/faq/page.css'],
		});
		const faqZh = page({
			clusterKey: 'faq-zh-cluster',
			tokens: shared,
			paths: ['zh', 'faq', 'index.html'],
			stylesheetHrefs: ['https://example.test/zh/faq/page.css'],
		});
		// Enough distinct skeletons for detectMirrorAxis's minSkeletonCount.
		const accessEn = page({
			clusterKey: 'other',
			tokens: new Set(['u1']),
			paths: ['en', 'access', 'index.html'],
		});
		const accessZh = page({
			clusterKey: 'other',
			tokens: new Set(['u1']),
			paths: ['zh', 'access', 'index.html'],
		});
		const galleryEn = page({
			clusterKey: 'other',
			tokens: new Set(['u2']),
			paths: ['en', 'gallery', 'index.html'],
		});
		const galleryZh = page({
			clusterKey: 'other',
			tokens: new Set(['u2']),
			paths: ['zh', 'gallery', 'index.html'],
		});

		const report = validateClusterPartition([
			faqEn,
			faqZh,
			accessEn,
			accessZh,
			galleryEn,
			galleryZh,
		]);

		expect(report.mirrorAxis).toEqual({ position: 0, values: new Set(['en', 'zh']) });
		expect(report.crossClusterDuplicates).toHaveLength(1);
		expect(report.crossClusterDuplicates[0]).toEqual({
			clusterKeyA: 'faq-en-cluster',
			clusterKeyB: 'faq-zh-cluster',
			similarity: 1,
			corroboratedByMirrorAxis: true,
		});
		expect(report.cohesion.map((c) => c.clusterKey).toSorted()).toEqual(
			['faq-en-cluster', 'faq-zh-cluster', 'other'].toSorted(),
		);
	});

	test('mirrorAxis is null and no near-duplicate pass runs when the corpus has no mirror', () => {
		const pages = [
			page({
				clusterKey: 'a',
				tokens: new Set(['t1', 't2']),
				paths: ['faq', 'index.html'],
			}),
			page({
				clusterKey: 'b',
				tokens: new Set(['t3', 't4']),
				paths: ['access', 'index.html'],
			}),
		];
		const report = validateClusterPartition(pages);
		expect(report.mirrorAxis).toBeNull();
		expect(report.crossClusterDuplicates).toEqual([]);
	});

	test('flags a cluster mixing unrelated templates as suspicious', () => {
		const pages = [
			...Array.from({ length: 3 }, () =>
				page({ clusterKey: 'mixed', tokens: new Set(['faq-a', 'faq-b']) }),
			),
			...Array.from({ length: 3 }, () =>
				page({ clusterKey: 'mixed', tokens: new Set(['gallery-a', 'gallery-b']) }),
			),
		];
		const report = validateClusterPartition(pages);
		expect(report.cohesion[0]!.suspicious).toBe(true);
	});

	test('forwards cohesion and crossClusterDuplicates options', () => {
		const shared = new Set(['t1', 't2']);
		const pages = [
			page({ clusterKey: 'a', tokens: shared, paths: ['en', 'faq', 'index.html'] }),
			page({ clusterKey: 'b', tokens: shared, paths: ['zh', 'faq', 'index.html'] }),
			page({
				clusterKey: 'other',
				tokens: new Set(['u1']),
				paths: ['en', 'access', 'index.html'],
			}),
			page({
				clusterKey: 'other',
				tokens: new Set(['u1']),
				paths: ['zh', 'access', 'index.html'],
			}),
			page({
				clusterKey: 'other',
				tokens: new Set(['u2']),
				paths: ['en', 'gallery', 'index.html'],
			}),
			page({
				clusterKey: 'other',
				tokens: new Set(['u2']),
				paths: ['zh', 'gallery', 'index.html'],
			}),
		];
		const report = validateClusterPartition(pages, { cohesion: { maxSampleSize: 1 } });
		const otherReport = report.cohesion.find((c) => c.clusterKey === 'other')!;
		// maxSampleSize: 1 means fewer than 2 members ever get compared.
		expect(otherReport.medianPairSimilarity).toBeNull();
	});
});
