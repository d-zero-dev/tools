import { describe, expect, test } from 'vitest';

import { computeClusterCohesion } from './compute-cluster-cohesion.js';

const CORE = [
	'body>header',
	'body>header>nav',
	'body>main>article',
	'body>main>article>h1',
	'body>main>article>.lead',
	'body>main>article>.breadcrumb',
	'body>main>article>.related',
	'body>main>article>.related>ul',
	'body>footer',
	'body>footer>nav',
	'body>footer>.copyright',
	'body>.cookie-bar',
];

describe('computeClusterCohesion', () => {
	test('a cluster whose members share identical token sets is not suspicious', () => {
		const members = Array.from({ length: 5 }, () => new Set(CORE));
		const report = computeClusterCohesion(new Map([['k', members]]));
		expect(report[0]!.medianPairSimilarity).toBe(1);
		expect(report[0]!.suspicious).toBe(false);
	});

	test('a cluster mixing two unrelated token sets is suspicious', () => {
		const members = [
			...Array.from(
				{ length: 3 },
				() => new Set(['body>main>.faq', 'body>main>.faq>dl']),
			),
			...Array.from(
				{ length: 3 },
				() => new Set(['body>main>.gallery', 'body>main>.gallery>ul']),
			),
		];
		const report = computeClusterCohesion(new Map([['k', members]]));
		expect(report[0]!.medianPairSimilarity).toBe(0);
		expect(report[0]!.suspicious).toBe(true);
	});

	test('legitimate per-page variation within one template stays below the suspicious threshold', () => {
		// Each member shares all of CORE plus exactly one page-specific token —
		// high but non-1.0 pairwise similarity, modeling a real template whose
		// pages differ in an optional section.
		const members = Array.from(
			{ length: 8 },
			(_, i) => new Set([...CORE, `body>main>.extra-${i}`]),
		);
		const report = computeClusterCohesion(new Map([['k', members]]));
		expect(report[0]!.medianPairSimilarity).toBeGreaterThan(0.75);
		expect(report[0]!.suspicious).toBe(false);
	});

	test('a single-member cluster reports null similarities and is never suspicious', () => {
		const report = computeClusterCohesion(new Map([['k', [new Set(CORE)]]]));
		expect(report[0]).toEqual({
			clusterKey: 'k',
			memberCount: 1,
			sampledMemberCount: 1,
			medianPairSimilarity: null,
			p10PairSimilarity: null,
			minPairSimilarity: null,
			suspicious: false,
		});
	});

	test('an empty cluster (defensive — should not normally occur) reports null similarities', () => {
		const report = computeClusterCohesion(new Map([['k', []]]));
		expect(report[0]!.sampledMemberCount).toBe(0);
		expect(report[0]!.medianPairSimilarity).toBeNull();
	});

	test('sampling bounds cost for large clusters and stays deterministic across calls', () => {
		const members = Array.from({ length: 500 }, () => new Set(CORE));
		const membersByKey = new Map([['k', members]]);
		const first = computeClusterCohesion(membersByKey, { maxSampleSize: 20 });
		const second = computeClusterCohesion(membersByKey, { maxSampleSize: 20 });
		expect(first[0]!.sampledMemberCount).toBe(20);
		expect(first[0]!.memberCount).toBe(500);
		expect(first).toEqual(second);
	});

	test('suspiciousMedianBelow is overridable', () => {
		const members = Array.from(
			{ length: 4 },
			(_, i) => new Set([...CORE, `body>main>.extra-${i}`]),
		);
		const membersByKey = new Map([['k', members]]);
		const lenient = computeClusterCohesion(membersByKey, { suspiciousMedianBelow: 0.5 });
		const strict = computeClusterCohesion(membersByKey, { suspiciousMedianBelow: 0.99 });
		expect(lenient[0]!.suspicious).toBe(false);
		expect(strict[0]!.suspicious).toBe(true);
	});

	test('reports one entry per cluster key, independent of the others', () => {
		const report = computeClusterCohesion(
			new Map([
				['pure', Array.from({ length: 3 }, () => new Set(CORE))],
				['mixed', [new Set(['a', 'b']), new Set(['c', 'd']), new Set(['e', 'f'])]],
			]),
		);
		expect(report).toHaveLength(2);
		expect(report.find((r) => r.clusterKey === 'pure')!.suspicious).toBe(false);
		expect(report.find((r) => r.clusterKey === 'mixed')!.suspicious).toBe(true);
	});
});
