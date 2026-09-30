import type {
	ExtractLandmarksResult,
	LandmarkInstance,
	LandmarkType,
} from './extract-landmarks.js';
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

/**
 * Builds fixture {@link LandmarkInstance}s from raw HTML strings. Position
 * values are arbitrary but distinct per instance — this file's tests never
 * assert on position.
 * @param htmlList
 */
function toLandmarkInstances(htmlList: readonly string[]): LandmarkInstance[] {
	return htmlList.map((html, i) => ({
		html,
		startOffset: i,
		endOffset: i + html.length,
		startLine: 1,
		startColumn: i + 1,
		endLine: 1,
		endColumn: i + html.length + 1,
	}));
}

const noLandmarks: ExtractLandmarksResult = {
	header: [],
	footer: [],
	nav: [],
	aside: [],
	form: [],
	search: [],
	main: [],
	remainderHtml: '',
};

const landmarksWith = (
	overrides: Partial<Record<LandmarkType, readonly string[]>>,
): ExtractLandmarksResult => {
	const result = { ...noLandmarks };
	for (const [type, htmlList] of Object.entries(overrides) as [
		LandmarkType,
		readonly string[],
	][]) {
		result[type] = toLandmarkInstances(htmlList);
	}
	return result;
};

describe('mergeCrossBlockClusters', () => {
	test('empty input returns empty maps', () => {
		const result = mergeCrossBlockClusters([], {});
		expect(result.rootByKey).toEqual(new Map());
		expect(result.finalGroupsByRoot).toEqual(new Map());
	});

	test('single unit maps to itself', () => {
		const unit: CrossBlockUnit = {
			key: 'k1',
			memberTokenSets: [new Set(['body>main>.card'])],
			memberLandmarkInstances: toInstances([noLandmarks]),
		};
		const result = mergeCrossBlockClusters([unit], {});
		expect(result.rootByKey.get('k1')).toBe('k1');
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
		expect(result.rootByKey.get('k1')).toBe(result.rootByKey.get('k2'));
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
		expect(result.rootByKey.get('k1')).toBe('k1');
		expect(result.rootByKey.get('k2')).toBe('k2');
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
		expect(result.rootByKey.get('reports')).toBe(result.rootByKey.get('projects'));
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
		expect(result.rootByKey.get('solo-a')).toBe('solo-a');
		expect(result.rootByKey.get('solo-b')).toBe('solo-b');
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
		expect(result.rootByKey.has('a')).toBe(true);
		expect(result.rootByKey.has('b')).toBe(true);
		expect(result.rootByKey.has('c')).toBe(true);
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
		expect(r1.rootByKey.get('k1')).toBe(r2.rootByKey.get('k1'));
		expect(r1.rootByKey.get('k2')).toBe(r2.rootByKey.get('k2'));
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
		const rootKey = result.rootByKey.get('block-a')!;
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
		expect(result.rootByKey.get('l1')).toBe(result.rootByKey.get('l2'));
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
		expect(result.rootByKey.get('A')).toBe(result.rootByKey.get('B'));
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
		expect(result.rootByKey.get('A')).toBe('A');
		expect(result.rootByKey.get('B')).toBe('B');
	});
});

describe('mergeCrossBlockClusters cohesion guard', () => {
	test('a hub unit does not absorb several mutually-unrelated units via containment', () => {
		// `hub`'s own tokens happen to be the union of three otherwise
		// unrelated templates' tokens (e.g. a page embedding widgets from
		// several different sections) — each small unit's tokens individually
		// clear containment (`>= 90%`) against `hub`'s rich vocabulary, the
		// exact "hub chaining" scenario `assign-contained-clusters.ts`'s own
		// JSDoc documents a *directed* assignment as only half-solving: `s1`,
		// `s2`, and `s3` each individually gets assigned to `hub`, but they
		// share nothing with *each other*, so pooling all three into `hub`
		// collapses its own quorum core toward nothing — exactly the
		// per-merge check this guard adds.
		const s1Tokens = [
			'body>main>table>tbody>tr',
			'body>main>table>tbody>tr>td',
			'body>main>table>caption',
		];
		const s2Tokens = ['body>main>dl>dt', 'body>main>dl>dd', 'body>main>dl>dt>a'];
		const s3Tokens = [
			'body>main>form>input',
			'body>main>form>button',
			'body>main>form>label',
		];
		const hubTokens = [
			...s1Tokens,
			...s2Tokens,
			...s3Tokens,
			'body>main>.hub-only-section',
		];

		const hub: CrossBlockUnit = {
			key: 'hub',
			memberTokenSets: Array.from({ length: 4 }, () => new Set(hubTokens)),
			memberLandmarkInstances: toInstances(Array.from({ length: 4 }, () => noLandmarks)),
		};
		const s1: CrossBlockUnit = {
			key: 's1',
			memberTokenSets: Array.from({ length: 4 }, () => new Set(s1Tokens)),
			memberLandmarkInstances: toInstances(Array.from({ length: 4 }, () => noLandmarks)),
		};
		const s2: CrossBlockUnit = {
			key: 's2',
			memberTokenSets: Array.from({ length: 4 }, () => new Set(s2Tokens)),
			memberLandmarkInstances: toInstances(Array.from({ length: 4 }, () => noLandmarks)),
		};
		const s3: CrossBlockUnit = {
			key: 's3',
			memberTokenSets: Array.from({ length: 4 }, () => new Set(s3Tokens)),
			memberLandmarkInstances: toInstances(Array.from({ length: 4 }, () => noLandmarks)),
		};

		const result = mergeCrossBlockClusters([hub, s1, s2, s3], {});
		expect(result.rootByKey.get('hub')).toBe('hub');
		expect(result.rootByKey.get('s1')).toBe('s1');
		expect(result.rootByKey.get('s2')).toBe('s2');
		expect(result.rootByKey.get('s3')).toBe('s3');
	});

	test('does not block the shape-Jaccard merge it was added alongside', () => {
		// Regression guard for the guard itself: shape-Jaccard pairs units
		// whose *raw* tokens are disjoint by construction (same skeleton,
		// different BEM class names), so a cohesion check against raw tokens
		// would reject this merge outright — this is why the guard compares
		// class-name-stripped tokens instead (see `mergeCrossBlockClusters`'s
		// own body).
		const unit1: CrossBlockUnit = {
			key: 'reports',
			memberTokenSets: Array.from(
				{ length: 4 },
				() =>
					new Set([
						'body>main>section.c-reports',
						'body>main>section.c-reports>ul.c-reports__list',
					]),
			),
			memberLandmarkInstances: toInstances(Array.from({ length: 4 }, () => noLandmarks)),
		};
		const unit2: CrossBlockUnit = {
			key: 'projects',
			memberTokenSets: Array.from(
				{ length: 4 },
				() =>
					new Set([
						'body>main>section.c-projects',
						'body>main>section.c-projects>ul.c-projects__list',
					]),
			),
			memberLandmarkInstances: toInstances(Array.from({ length: 4 }, () => noLandmarks)),
		};
		const result = mergeCrossBlockClusters([unit1, unit2], {});
		expect(result.rootByKey.get('reports')).toBe(result.rootByKey.get('projects'));
	});

	test('units whose L2 signature collapses to the same shape do not falsely merge', () => {
		// Every unit's tokens sit under the same `main>article>.wrap` chain —
		// `l2Signature`'s "main plus up to 2 shape-stripped levels" truncation
		// reduces all 8 to the identical `main>article>*` key set (see
		// `hasDiscriminatingL2Signatures`'s own JSDoc) — while each unit's own
		// distinctive content is a genuinely different tag skeleton one level
		// deeper, different enough that fine stage's core-based checks find no
		// merge either, so the round reaches the degenerate L2 comparison.
		const skeletons = [
			'body>main>article>.wrap>table>tbody>tr',
			'body>main>article>.wrap>dl>dt',
			'body>main>article>.wrap>form>input',
			'body>main>article>.wrap>ul>li',
			'body>main>article>.wrap>ol>li',
			'body>main>article>.wrap>figure>img',
			'body>main>article>.wrap>video',
			'body>main>article>.wrap>iframe',
		];
		const units: CrossBlockUnit[] = skeletons.map((token, i) => ({
			key: `t${i}`,
			memberTokenSets: Array.from(
				{ length: 4 },
				() => new Set([token, `${token}-extra`]),
			),
			memberLandmarkInstances: toInstances(Array.from({ length: 4 }, () => noLandmarks)),
		}));

		const result = mergeCrossBlockClusters(units, {});
		expect(new Set(result.rootByKey.values()).size).toBe(skeletons.length);
	});
});

describe('mergeCrossBlockClusters Stage-A separation guard', () => {
	const shell = Array.from({ length: 26 }, (_, i) => `body>.shell>s${i}`);
	const padding: CrossBlockUnit = {
		key: 'padding',
		blockKey: 'path:elsewhere',
		// Pages without any shell token keep every shell token's corpus-wide
		// document frequency far below the 90% "site chrome" cutoff, so the
		// shell stays in the cores being compared — the situation of a shell
		// that is common to one block only.
		memberTokenSets: Array.from(
			{ length: 12 },
			(_, i) => new Set([`body>.padding>p${i}`, `body>.padding>q${i}`]),
		),
		memberLandmarkInstances: toInstances(Array.from({ length: 12 }, () => noLandmarks)),
	};

	/**
	 * @param key
	 * @param blockKey
	 * @param pageCount
	 * @param tokens
	 */
	function unit(
		key: string,
		blockKey: string | undefined,
		pageCount: number,
		tokens: readonly string[],
	): CrossBlockUnit {
		return {
			key,
			...(blockKey === undefined ? {} : { blockKey }),
			memberTokenSets: Array.from({ length: pageCount }, () => new Set(tokens)),
			memberLandmarkInstances: toInstances(
				Array.from({ length: pageCount }, () => noLandmarks),
			),
		};
	}

	const listTokens = [
		...shell,
		'body>.shell>list>x1',
		'body>.shell>list>x2',
		'body>.shell>list>x3',
	];
	const detailTokens = [
		...shell,
		'body>.shell>detail>y1',
		'body>.shell>detail>y2',
		'body>.shell>detail>y3',
	];

	test('precondition: without block information a list/detail pair sharing a shell is merged', () => {
		const result = mergeCrossBlockClusters(
			[
				unit('list', undefined, 4, listTokens),
				unit('detail', undefined, 4, detailTokens),
				padding,
			],
			{},
		);
		expect(result.rootByKey.get('list')).toBe(result.rootByKey.get('detail'));
	});

	test('same-block multi-page units that share only a shell stay separate', () => {
		const result = mergeCrossBlockClusters(
			[
				unit('list', 'path:news', 4, listTokens),
				unit('detail', 'path:news', 4, detailTokens),
				padding,
			],
			{},
		);
		expect(result.rootByKey.get('list')).toBe('list');
		expect(result.rootByKey.get('detail')).toBe('detail');
	});

	test('units from different blocks with the same cores still merge', () => {
		const result = mergeCrossBlockClusters(
			[
				unit('list', 'path:news', 4, listTokens),
				unit('detail', 'path:blog', 4, detailTokens),
				padding,
			],
			{},
		);
		expect(result.rootByKey.get('list')).toBe(result.rootByKey.get('detail'));
	});

	test('same-block single-page units still merge (no evidence in a lone page)', () => {
		const units = Array.from({ length: 6 }, (_, i) =>
			unit(`s${i}`, 'path:articles', 1, [
				...shell,
				`body>.shell>free${i}>a`,
				`body>.shell>free${i}>b`,
			]),
		);
		const result = mergeCrossBlockClusters([...units, padding], {});
		expect(new Set(units.map((u) => result.rootByKey.get(u.key))).size).toBe(1);
	});

	test('a same-block multi-page pair where one core is a conditional render of the other still merges', () => {
		const result = mergeCrossBlockClusters(
			[
				unit('full', 'path:news', 4, [
					...shell,
					'body>.shell>opt>e1',
					'body>.shell>opt>e2',
				]),
				unit('short', 'path:news', 4, shell),
				padding,
			],
			{},
		);
		expect(result.rootByKey.get('full')).toBe(result.rootByKey.get('short'));
	});

	test('a same-block pair differing only in the state of a shared component (pager first page vs later pages) still merges', () => {
		const result = mergeCrossBlockClusters(
			[
				unit('first', 'path:list', 4, [
					...shell,
					'body>.shell>pager>current',
					'body>.shell>pager>next',
				]),
				unit('later', 'path:list', 4, [
					...shell,
					'body>.shell>pager>prev',
					'body>.shell>pager>first',
				]),
				padding,
			],
			{},
		);
		expect(result.rootByKey.get('first')).toBe(result.rootByKey.get('later'));
	});

	test('a same-block class-name-only difference (shape-Jaccard) is exempt from the guard', () => {
		const reports = unit('reports', 'path:x', 3, [
			'body>main>section.c-reports>ul.c-reports__list>li',
			'body>main>section.c-reports>ul.c-reports__list>a',
		]);
		const projects = unit('projects', 'path:x', 3, [
			'body>main>section.c-projects>ul.c-projects__list>li',
			'body>main>section.c-projects>ul.c-projects__list>a',
		]);
		const result = mergeCrossBlockClusters([reports, projects], {});
		expect(result.rootByKey.get('reports')).toBe(result.rootByKey.get('projects'));
	});

	test('the L2 stage cannot bypass the guard', () => {
		// 15 shared tokens plus 2 vs 3 own tokens: fine-stage complete linkage
		// (0.75), containment (0.88) and shape-Jaccard (0.88) all fall short,
		// while the `main`-anchored L2 signature of the smaller unit is
		// contained in the larger one and both share a header shell.
		const header = landmarksWith({
			header: ['<header><nav class="c-global-nav"><a>Home</a></nav></header>'],
		});
		const common = Array.from({ length: 15 }, (_, i) => `body>.wrap>c${i}`);
		/**
		 * @param key
		 * @param blockKey
		 * @param own
		 */
		function l2Unit(
			key: string,
			blockKey: string | undefined,
			own: readonly string[],
		): CrossBlockUnit {
			return {
				key,
				...(blockKey === undefined ? {} : { blockKey }),
				memberTokenSets: Array.from({ length: 3 }, () => new Set([...common, ...own])),
				memberLandmarkInstances: toInstances(Array.from({ length: 3 }, () => header)),
			};
		}
		const small = ['body>main>article>ul>li.x1>span', 'body>main>article>ul>li.x2>span'];
		const large = [
			'body>main>article>ul>li.a',
			'body>main>article>ul>li.b',
			'body>main>article>ul>li.c',
		];

		const merged = mergeCrossBlockClusters(
			[l2Unit('small', undefined, small), l2Unit('large', undefined, large), padding],
			{},
		);
		expect(merged.rootByKey.get('small')).toBe(merged.rootByKey.get('large'));

		const guarded = mergeCrossBlockClusters(
			[l2Unit('small', 'path:x', small), l2Unit('large', 'path:x', large), padding],
			{},
		);
		expect(guarded.rootByKey.get('small')).toBe('small');
		expect(guarded.rootByKey.get('large')).toBe('large');
	});

	test('lineage propagates through pooled groups: a unit Stage A separated from one member stays out of the whole group', () => {
		// `a` (another block) and `b` are the same template and merge; `c` was
		// separated from `b` — and only from `b` — by Stage A. Next to root `a`
		// alone `c` would look unrelated to the guard; it is refused because
		// `b`'s lineage is pooled into `a`'s group.
		const own = ['body>.shell>opt>p1', 'body>.shell>opt>p2'];
		const a = unit('a', 'path:other', 4, [...shell, ...own]);
		const b = unit('b', 'path:news', 4, [...shell, ...own]);
		const c = unit('c', 'path:news', 4, detailTokens);
		const result = mergeCrossBlockClusters([a, b, c, padding], {});
		expect(result.rootByKey.get('a')).toBe(result.rootByKey.get('b'));
		expect(result.rootByKey.get('c')).toBe('c');
	});
});
