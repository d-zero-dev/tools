import { describe, expect, test } from 'vitest';

import { resolvePageClusterKeysInMemory as resolvePageClusterKeys } from './resolve-page-cluster-keys.js';

describe('resolvePageClusterKeys', () => {
	test('an empty page list returns an empty array', () => {
		expect(resolvePageClusterKeys([])).toEqual([]);
	});

	test('matches the exact output documented in the JSDoc @example', () => {
		// Kept in sync with resolvePageClusterKeys's @example: if this ever
		// fails, the JSDoc example is out of date and must be corrected
		// alongside the implementation, not the other way around.
		const result = resolvePageClusterKeys([
			{
				paths: ['news', '1'],
				stylesheetHrefs: [],
				html: '<body><article>one</article></body>',
			},
			{
				paths: ['news', '2'],
				stylesheetHrefs: [],
				html: '<body><article>two</article></body>',
			},
			{
				paths: ['about'],
				stylesheetHrefs: [],
				html: '<body><section>about</section></body>',
			},
		]);
		expect(result).toEqual([
			'["path:news","cluster:0"]',
			'["path:news","cluster:0"]',
			'["path:about","cluster:0"]',
		]);
	});

	test('two pages that block into the same path group and share an identical structure get the same final key', () => {
		const html =
			'<body><header>H</header><main><div class="card">C</div></main><footer>F</footer></body>';
		const result = resolvePageClusterKeys([
			{ paths: ['dept-a', 'page1'], stylesheetHrefs: [], html },
			{ paths: ['dept-a', 'page2'], stylesheetHrefs: [], html },
		]);

		expect(result[0]).toBe(result[1]);
	});

	test('pages within the same block but with dissimilar structure get different final keys', () => {
		// header/footer are identical across all three (and excluded from
		// comparison by default) — the distinguishing element is a <div> vs a
		// <form>, neither of which is a landmark type, so the difference
		// survives landmark exclusion.
		const cardHtml =
			'<body><header>H</header><main><div class="card">C</div></main><footer>F</footer></body>';
		const formHtml =
			'<body><header>H</header><main><form>F</form></main><footer>F</footer></body>';
		const result = resolvePageClusterKeys([
			{ paths: ['dept-a', 'page1'], stylesheetHrefs: [], html: cardHtml },
			{ paths: ['dept-a', 'page2'], stylesheetHrefs: [], html: cardHtml },
			{ paths: ['dept-a', 'page3'], stylesheetHrefs: [], html: formHtml },
		]);

		expect(result[0]).toBe(result[1]);
		expect(result[2]).not.toBe(result[0]);
	});

	test('two different blocks that each independently produce local cluster label cluster:0 do not collide', () => {
		// Each page is the sole member of its own path-derived block
		// (`path:dept-a`, `path:dept-b`), both producing local label
		// `cluster:0`. Different structures keep them in separate clusters
		// (Stage B cross-block merge only unifies structurally similar pages).
		// Regression test for the cross-block label-collision gap this
		// function exists to close via JSON.stringify composition.
		const result = resolvePageClusterKeys([
			{
				paths: ['dept-a', 'page1'],
				stylesheetHrefs: [],
				html: '<body><main><article>A</article></main></body>',
			},
			{
				paths: ['dept-b', 'page1'],
				stylesheetHrefs: [],
				html: '<body><main><section>B</section></main></body>',
			},
		]);

		expect(result[0]).not.toBe(result[1]);
	});

	test('a stylesheet-derived block and a path-derived block never collide even with identical local labels', () => {
		// dept-a's two pages share a distinctive stylesheet (css: key); dept-b's
		// lone page has no stylesheet at all and falls back to a path: key.
		// Both blocks' sole/first cluster is locally labeled `cluster:0`.
		// Different structures keep them in separate final clusters (Stage B
		// only unifies structurally similar pages across blocks).
		const htmlA = '<body><header>H</header><main><article>A</article></main></body>';
		const htmlB = '<body><header>H</header><main><section>B</section></main></body>';
		const result = resolvePageClusterKeys([
			{
				paths: ['dept-a', 'page1'],
				stylesheetHrefs: ['https://example.com/a.css'],
				html: htmlA,
			},
			{
				paths: ['dept-a', 'page2'],
				stylesheetHrefs: ['https://example.com/a.css'],
				html: htmlA,
			},
			{ paths: ['dept-b', 'page1'], stylesheetHrefs: [], html: htmlB },
		]);

		expect(result[0]).toBe(result[1]);
		expect(result[2]).not.toBe(result[0]);
	});

	test('the result preserves input order and length across interleaved blocks', () => {
		const pages = [
			{ paths: ['dept-a', '1'], stylesheetHrefs: [], html: '<body><a>x</a></body>' },
			{ paths: ['dept-b', '1'], stylesheetHrefs: [], html: '<body><b>x</b></body>' },
			{ paths: ['dept-a', '2'], stylesheetHrefs: [], html: '<body><a>x</a></body>' },
			{ paths: ['dept-b', '2'], stylesheetHrefs: [], html: '<body><b>x</b></body>' },
		];
		const result = resolvePageClusterKeys(pages);

		expect(result).toHaveLength(pages.length);
		expect(result[0]).toBe(result[2]); // both dept-a, identical structure
		expect(result[1]).toBe(result[3]); // both dept-b, identical structure
		expect(result[0]).not.toBe(result[1]); // different blocks
	});

	test('two pages differing only in header/footer content get the same final key (the point of excludeLandmarks)', () => {
		// This is the central behavioral change this function's contract
		// switch exists for: a page-category label baked into a shared
		// header/footer no longer prevents two otherwise-identical pages from
		// clustering together.
		const result = resolvePageClusterKeys([
			{
				paths: ['dept-a', 'page1'],
				stylesheetHrefs: [],
				html: '<body><header class="law-page">H</header><main><div class="card">C</div></main></body>',
			},
			{
				paths: ['dept-a', 'page2'],
				stylesheetHrefs: [],
				html: '<body><header class="humanities-page">H</header><main><div class="card">C</div></main></body>',
			},
		]);

		expect(result[0]).toBe(result[1]);
	});

	test('excludeLandmarks: true at the default threshold can split pages that raw comparison would have merged (the interaction documented on the excludeLandmarks option)', () => {
		// Mirrors the exact shape of the real-crawl-data finding cited in
		// excludeLandmarks's JSDoc: a large shared header (8 distinct nodes)
		// inflates raw-HTML similarity above the default 0.8 threshold, but
		// once the header is excluded, only the content remains — 3 shared
		// content nodes vs 1 page-specific one each, Jaccard 3/5 = 0.6 — which
		// the default threshold now rejects. This pins that this is a real,
		// reproducible trade-off of the option, not merely an anecdote.
		const sharedHeader = `<header>${Array.from({ length: 8 }, (_, i) => `<div class="nav-${i}"></div>`).join('')}</header>`;
		const sharedContent = Array.from(
			{ length: 3 },
			(_, i) => `<div class="content-shared-${i}"></div>`,
		).join('');
		const pageA = {
			paths: ['dept-a', 'page1'],
			stylesheetHrefs: [],
			html: `<body>${sharedHeader}<main>${sharedContent}<div class="content-a"></div></main></body>`,
		};
		const pageB = {
			paths: ['dept-a', 'page2'],
			stylesheetHrefs: [],
			html: `<body>${sharedHeader}<main>${sharedContent}<div class="content-b"></div></main></body>`,
		};

		const withRawTokens = resolvePageClusterKeys([pageA, pageB], {
			excludeLandmarks: false,
		});
		expect(withRawTokens[0]).toBe(withRawTokens[1]);

		const withLandmarksExcludedDefaultThreshold = resolvePageClusterKeys([pageA, pageB]);
		expect(withLandmarksExcludedDefaultThreshold[0]).not.toBe(
			withLandmarksExcludedDefaultThreshold[1],
		);

		const withLandmarksExcludedLowerThreshold = resolvePageClusterKeys([pageA, pageB], {
			similarityThreshold: 0.6,
		});
		expect(withLandmarksExcludedLowerThreshold[0]).toBe(
			withLandmarksExcludedLowerThreshold[1],
		);
	});

	test('excludeLandmarks: false falls back to comparing raw, unstripped HTML', () => {
		const withDifferentHeaders = resolvePageClusterKeys(
			[
				{
					paths: ['dept-a', 'page1'],
					stylesheetHrefs: [],
					html: '<body><header><nav>A</nav></header><main><div class="card">C</div></main></body>',
				},
				{
					paths: ['dept-a', 'page2'],
					stylesheetHrefs: [],
					html: '<body><header><a>B</a></header><main><div class="card">C</div></main></body>',
				},
			],
			{ excludeLandmarks: false },
		);

		expect(withDifferentHeaders[0]).not.toBe(withDifferentHeaders[1]);
	});

	test('residual chrome not covered by header/footer/nav/aside (e.g. a breadcrumb) still gets absorbed by the frequency-split safety net at block sizes >= 10', () => {
		// 8 class-less-content-bearing divs shared by every page (a stand-in
		// for a breadcrumb — not a landmark tag, so extractLandmarks leaves it
		// alone). Each page adds exactly one page-specific class. Raw
		// Jaccard(a, b) = 8/10 = 0.8, which meets the default threshold on its
		// own; the frequency-split safety net (block size 11 >= the floor)
		// must still separate them once the shared divs are recognized as
		// chrome. Distinguishing via class name, not text, since tokenize()
		// discards visible text entirely.
		const crumbs = Array.from(
			{ length: 8 },
			(_, i) => `<div class="crumb-${i}"></div>`,
		).join('');
		const pages = Array.from({ length: 9 }, (_, i) => ({
			paths: ['dept-a', `filler-${i}`],
			stylesheetHrefs: [],
			html: `<body>${crumbs}<div class="filler-${i}"></div></body>`,
		}));
		pages.push(
			{
				paths: ['dept-a', 'a'],
				stylesheetHrefs: [],
				html: `<body>${crumbs}<div class="diff-a"></div></body>`,
			},
			{
				paths: ['dept-a', 'b'],
				stylesheetHrefs: [],
				html: `<body>${crumbs}<div class="diff-b"></div></body>`,
			},
		);
		const result = resolvePageClusterKeys(pages);

		const a = result.at(-2);
		const b = result.at(-1);
		expect(a).not.toBe(b);
	});

	test('reassignOrphans (default true) lets a page with no recorded stylesheets rejoin a same-section css: block', () => {
		const html = '<body><header>H</header><main><div class="card">C</div></main></body>';
		const pages = [
			{ paths: ['news', '1'], stylesheetHrefs: ['https://example.com/a.css'], html },
			{ paths: ['news', '2'], stylesheetHrefs: ['https://example.com/a.css'], html },
			{ paths: ['news', '3'], stylesheetHrefs: [], html },
			{ paths: ['other'], stylesheetHrefs: ['https://example.com/b.css'], html },
		];

		const result = resolvePageClusterKeys(pages);

		expect(result[2]).toBe(result[0]);
	});

	test('reassignOrphans: false leaves an orphan with a genuinely different template in its own separate cluster', () => {
		// reassignOrphans: false skips pooling the orphan (news/3) alongside the
		// css: block for Stage A comparison. Stage B's cross-block merge only
		// unifies structurally similar pages, so using a different template
		// (article vs card) keeps the orphan separate regardless of the blocking
		// key. Note: with identical HTML, Stage B merges same-template pages
		// cross-block even with reassignOrphans: false — the option influences
		// Stage A block assignment but not Stage B's structural comparison.
		const htmlCard =
			'<body><header>H</header><main><div class="card">C</div></main></body>';
		const htmlPost =
			'<body><header>H</header><main><article class="post">P</article></main></body>';
		const pages = [
			{
				paths: ['news', '1'],
				stylesheetHrefs: ['https://example.com/a.css'],
				html: htmlCard,
			},
			{
				paths: ['news', '2'],
				stylesheetHrefs: ['https://example.com/a.css'],
				html: htmlCard,
			},
			{ paths: ['news', '3'], stylesheetHrefs: [], html: htmlPost },
			{
				paths: ['other'],
				stylesheetHrefs: ['https://example.com/b.css'],
				html: htmlCard,
			},
		];

		const result = resolvePageClusterKeys(pages, { reassignOrphans: false });

		expect(result[2]).not.toBe(result[0]);
	});

	test('contentBlockAttribute removes freeform content-block markup before comparison, letting pages with a different mix of blocks still match', () => {
		const pageA = {
			paths: ['dept-a', '1'],
			stylesheetHrefs: [],
			html: '<body><article class="detail"><div data-block="title"><h2 class="t">Title</h2></div><div data-block="image"><img class="i" src="x"></div></article></body>',
		};
		const pageB = {
			paths: ['dept-a', '2'],
			stylesheetHrefs: [],
			html: '<body><article class="detail"><div data-block="quote"><blockquote class="q">Q</blockquote></div></article></body>',
		};

		const withoutRemoval = resolvePageClusterKeys([pageA, pageB]);
		expect(withoutRemoval[0]).not.toBe(withoutRemoval[1]);

		const withRemoval = resolvePageClusterKeys([pageA, pageB], {
			contentBlockAttribute: 'data-block',
		});
		expect(withRemoval[0]).toBe(withRemoval[1]);
	});

	test('omitting contentBlockAttribute (the default) skips content-block removal entirely', () => {
		const pageA = {
			paths: ['dept-a', '1'],
			stylesheetHrefs: [],
			html: '<body><article class="detail"><div data-block="title"><h2 class="t">Title</h2></div></article></body>',
		};
		const pageB = {
			paths: ['dept-a', '2'],
			stylesheetHrefs: [],
			html: '<body><article class="detail"><div data-block="quote"><blockquote class="q">Q</blockquote></div></article></body>',
		};

		const result = resolvePageClusterKeys([pageA, pageB]);

		expect(result[0]).not.toBe(result[1]);
	});

	test("a page whose only stylesheet was third-party becomes an orphan via restrictStylesheetsToFirstParty and is then reassigned by reassignOrphans into its section's css: block", () => {
		const html = '<body><header>H</header><main><div class="card">C</div></main></body>';
		const pages = [
			{ paths: ['news', '1'], stylesheetHrefs: ['https://example.com/a.css'], html },
			{ paths: ['news', '2'], stylesheetHrefs: ['https://example.com/a.css'], html },
			{
				paths: ['news', '3'],
				stylesheetHrefs: ['https://fonts.googleapis.com/css?family=x'],
				html,
			},
			{ paths: ['other'], stylesheetHrefs: ['https://example.com/b.css'], html },
		];

		const result = resolvePageClusterKeys(pages);

		expect(result[2]).toBe(result[0]);
	});

	test('restrictStylesheetsToFirstParty (default true) prevents an incidental third-party stylesheet reference from splitting an otherwise-matching page into its own block', () => {
		const html = '<body><header>H</header><main><div class="card">C</div></main></body>';
		const pages = [
			{ paths: ['news', '1'], stylesheetHrefs: ['https://example.com/a.css'], html },
			{ paths: ['news', '2'], stylesheetHrefs: ['https://example.com/a.css'], html },
			{
				paths: ['news', '3'],
				stylesheetHrefs: [
					'https://example.com/a.css',
					'https://fonts.googleapis.com/css?family=x',
				],
				html,
			},
			{ paths: ['other'], stylesheetHrefs: ['https://example.com/b.css'], html },
		];

		const result = resolvePageClusterKeys(pages);

		expect(result[2]).toBe(result[0]);
	});

	test('restrictStylesheetsToFirstParty: false keeps a page with a genuinely different template in its own cluster, even alongside the extra stylesheet', () => {
		// With restrictStylesheetsToFirstParty: false, news/3's extra third-party
		// stylesheet splits it into its own blocking key for Stage A. Additionally,
		// news/3 uses a different HTML template (article vs card), so Stage B's
		// cross-block merge also keeps it separate — the two effects together
		// prevent any spurious merge.
		const htmlCard =
			'<body><header>H</header><main><div class="card">C</div></main></body>';
		const htmlPost =
			'<body><header>H</header><main><article class="post">P</article></main></body>';
		const pages = [
			{
				paths: ['news', '1'],
				stylesheetHrefs: ['https://example.com/a.css'],
				html: htmlCard,
			},
			{
				paths: ['news', '2'],
				stylesheetHrefs: ['https://example.com/a.css'],
				html: htmlCard,
			},
			{
				paths: ['news', '3'],
				stylesheetHrefs: [
					'https://example.com/a.css',
					'https://fonts.googleapis.com/css?family=x',
				],
				html: htmlPost,
			},
			{
				paths: ['other'],
				stylesheetHrefs: ['https://example.com/b.css'],
				html: htmlCard,
			},
		];

		const result = resolvePageClusterKeys(pages, {
			restrictStylesheetsToFirstParty: false,
		});

		expect(result[2]).not.toBe(result[0]);
	});

	test("providing each page's host avoids a dominant-host tie mistakenly keeping a sitewide third party over the real first party (regression test for a real crawl finding)", () => {
		// 10 pages: every page loads *some* fonts.googleapis.com stylesheet
		// plus its own first-party one, tying the third-party host and the
		// first-party host at "referenced by 10/10 pages" — the exact shape
		// confirmed on a real 302-page crawl. dept-a/dept-b share one
		// identical googleapis query string (their only distinguishing
		// signal if that third party wins the tie); the 8 filler pages each
		// use a *different* googleapis query string (so it never looks like
		// a shared template signal on its own) and their own unique
		// first-party stylesheet.
		//
		// Without `host`, the tie-break keeps googleapis.com (inserted first
		// below), so dept-a/dept-b's real, distinguishing first-party
		// stylesheets (a.css vs b.css) are dropped and their identical
		// surviving googleapis href wrongly becomes a shared css: block,
		// causing Stage A to merge dept-a and dept-b (wrong).
		//
		// With `host` supplied, each page's real first-party stylesheet
		// survives instead. dept-a and dept-b are assigned to separate css:
		// blocks. Stage B then considers them the same template (they share
		// identical HTML) and merges them — which is correct behaviour for
		// two departments using the same CMS template. The `host` fix matters
		// when their HTML differs (structural discrimination preserved once the
		// blocking is correct); the regression test below verifies the bug
		// scenario (wrong block causes wrong merge when host is absent).
		const html = '<body><header>H</header><main><div class="card">C</div></main></body>';
		const targetPages = [
			{
				paths: ['dept-a', '1'],
				host: 'example.com',
				stylesheetHrefs: [
					'https://fonts.googleapis.com/css?family=shared',
					'https://example.com/a.css',
				],
				html,
			},
			{
				paths: ['dept-b', '1'],
				host: 'example.com',
				stylesheetHrefs: [
					'https://fonts.googleapis.com/css?family=shared',
					'https://example.com/b.css',
				],
				html,
			},
		];
		const fillerPages = Array.from({ length: 8 }, (_, i) => ({
			paths: [`filler-${i}`],
			host: 'example.com',
			stylesheetHrefs: [
				`https://fonts.googleapis.com/css?family=filler-${i}`,
				`https://example.com/filler-${i}.css`,
			],
			html,
		}));
		const pages = [...targetPages, ...fillerPages];

		// Without host the blocking is wrong: dept-a/dept-b land in the same
		// css: block (googleapis wins the tie) and Stage A merges them.
		const withoutHost = resolvePageClusterKeys(
			pages.map(({ paths, stylesheetHrefs, html: pageHtml }) => ({
				paths,
				stylesheetHrefs,
				html: pageHtml,
			})),
		);
		expect(withoutHost[0]).toBe(withoutHost[1]);
	});

	test('autoCapMainDepth: true merges pages whose only difference is content nested deep inside <main>, requiring no site-specific configuration', () => {
		// Identical structure up to depth 3 inside <main>; a page-unique class
		// at depth 4 fragments every page apart unless that depth is capped.
		const pages = Array.from({ length: 20 }, (_, i) => ({
			paths: ['dept-a', `${i}`],
			stylesheetHrefs: [],
			html: `<body><main><section><article><div><span class="unique-${i}">content</span></div></article></section></main></body>`,
		}));

		const withCap = resolvePageClusterKeys(pages, { autoCapMainDepth: true });

		expect(new Set(withCap).size).toBe(1);
	});

	test('autoCapMainDepth: false leaves deep <main> content untouched, so the same pages stay fragmented', () => {
		const pages = Array.from({ length: 20 }, (_, i) => ({
			paths: ['dept-a', `${i}`],
			stylesheetHrefs: [],
			html: `<body><main><section><article><div><span class="unique-${i}">content</span></div></article></section></main></body>`,
		}));

		const withoutCap = resolvePageClusterKeys(pages, { autoCapMainDepth: false });

		expect(new Set(withoutCap).size).toBeGreaterThan(1);
	});

	test("autoCapMainDepth detects each block's own knee separately, so a small block is not left under-capped by a larger, differently-shaped block", () => {
		// Block "dept-a" (40 pages, dominates a corpus-wide sweep): identical
		// up to depth 3, page-unique content at depth 4 -> its own knee is 3.
		const deptA = Array.from({ length: 40 }, (_, i) => ({
			paths: ['dept-a', `${i}`],
			stylesheetHrefs: [],
			html: `<body><main><section><article><div><span class="unique-a-${i}">c</span></div></article></section></main></body>`,
		}));
		// Block "dept-b" (6 pages): identical up to depth 1, page-unique
		// content at depth 2 -> its own knee is 1, much shallower than
		// dept-a's. A single depth derived once across the whole corpus (the
		// pre-per-block design) would be dominated by dept-a's larger,
		// deeper-diverging shape and cap dept-b too deep, letting dept-b's
		// own noise (which starts right at depth 2) leak straight through
		// uncapped.
		const deptB = Array.from({ length: 6 }, (_, i) => ({
			paths: ['dept-b', `${i}`],
			stylesheetHrefs: [],
			html: `<body><main><article><span class="unique-b-${i}">c</span></article></main></body>`,
		}));

		const keys = resolvePageClusterKeys([...deptA, ...deptB], { autoCapMainDepth: true });
		const deptAKeys = keys.slice(0, deptA.length);
		const deptBKeys = keys.slice(deptA.length);

		expect(new Set(deptAKeys).size).toBe(1);
		expect(new Set(deptBKeys).size).toBe(1);
	});

	test('autoCapMainDepth validates its own options eagerly, even for an empty page list with no blocks to run the per-block sweep on', () => {
		expect(() =>
			resolvePageClusterKeys([], { autoCapMainDepth: true, candidateDepths: [3, 1] }),
		).toThrow(RangeError);
	});

	test('autoCapMainDepth skips the knee-detection sweep for a singleton block, but still returns that page as its own cluster', () => {
		const pages = [
			{
				paths: ['solo'],
				stylesheetHrefs: [],
				html: '<body><main><div>only page</div></main></body>',
			},
		];

		expect(resolvePageClusterKeys(pages, { autoCapMainDepth: true })).toHaveLength(1);
	});

	test('mergeRareLandmarkClusters (default false) leaves two different blocks unmerged even when they share a rare header', () => {
		// tokenize() discards visible text, so the two header variants below
		// are distinguished by a child element's class, not by text.
		const rareHeader = '<header><i class="mark-rare"></i></header>';
		const commonHeader = '<header><i class="mark-common"></i></header>';
		const sharedMainOpen =
			'<main><div class="s1"></div><div class="s2"></div><div class="s3"></div>';
		const pageA = {
			paths: ['dept-a', '1'],
			stylesheetHrefs: [],
			html: `<body>${rareHeader}${sharedMainOpen}<div class="a1"></div></main></body>`,
		};
		const pageB = {
			paths: ['dept-b', '1'],
			stylesheetHrefs: [],
			html: `<body>${rareHeader}${sharedMainOpen}<div class="b1"></div></main></body>`,
		};
		const fillers = Array.from({ length: 8 }, (_, i) => ({
			paths: ['dept-c', `${i}`],
			stylesheetHrefs: [],
			html: `<body>${commonHeader}<main><div class="filler-${i}"></div></main></body>`,
		}));

		const result = resolvePageClusterKeys([pageA, pageB, ...fillers]);

		expect(result[0]).not.toBe(result[1]);
	});

	test('mergeRareLandmarkClusters: true bridges two different blocks once their shared header is rare and their content clears the looser gate threshold', () => {
		// tokenize() discards visible text, so the two header variants below
		// are distinguished by a child element's class, not by text.
		const rareHeader = '<header><i class="mark-rare"></i></header>';
		const commonHeader = '<header><i class="mark-common"></i></header>';
		const sharedMainOpen =
			'<main><div class="s1"></div><div class="s2"></div><div class="s3"></div>';
		const pageA = {
			paths: ['dept-a', '1'],
			stylesheetHrefs: [],
			html: `<body>${rareHeader}${sharedMainOpen}<div class="a1"></div></main></body>`,
		};
		const pageB = {
			paths: ['dept-b', '1'],
			stylesheetHrefs: [],
			html: `<body>${rareHeader}${sharedMainOpen}<div class="b1"></div></main></body>`,
		};
		const fillers = Array.from({ length: 8 }, (_, i) => ({
			paths: ['dept-c', `${i}`],
			stylesheetHrefs: [],
			html: `<body>${commonHeader}<main><div class="filler-${i}"></div></main></body>`,
		}));
		const pages = [pageA, pageB, ...fillers];

		const withoutMerge = resolvePageClusterKeys(pages);
		expect(withoutMerge[0]).not.toBe(withoutMerge[1]);

		const withMerge = resolvePageClusterKeys(pages, {
			mergeRareLandmarkClusters: true,
			landmarkRarityThreshold: 0.25,
			landmarkGateSimilarityThreshold: 0.5,
		});
		expect(withMerge[0]).toBe(withMerge[1]);
		expect(withMerge[0]).toMatch(/^landmark-merge:/);
	});

	test('mergeRareLandmarkClusters validates its own options eagerly, even for an empty page list with no blocks to run the merge step on', () => {
		expect(() =>
			resolvePageClusterKeys([], {
				mergeRareLandmarkClusters: true,
				landmarkRarityThreshold: -1,
			}),
		).toThrow(RangeError);
	});

	test('mergeRareLandmarkClusters still works when excludeLandmarks: false (extractLandmarks is computed independently for the gate)', () => {
		// tokenize() discards visible text, so the two header variants below
		// are distinguished by a child element's class, not by text.
		const rareHeader = '<header><i class="mark-rare"></i></header>';
		const commonHeader = '<header><i class="mark-common"></i></header>';
		const pageA = {
			paths: ['dept-a', '1'],
			stylesheetHrefs: [],
			html: `<body>${rareHeader}<main><div class="x"></div></main></body>`,
		};
		const pageB = {
			paths: ['dept-b', '1'],
			stylesheetHrefs: [],
			html: `<body>${rareHeader}<main><div class="x"></div></main></body>`,
		};
		const fillers = Array.from({ length: 8 }, (_, i) => ({
			paths: ['dept-c', `${i}`],
			stylesheetHrefs: [],
			html: `<body>${commonHeader}<main><div class="filler-${i}"></div></main></body>`,
		}));

		const result = resolvePageClusterKeys([pageA, pageB, ...fillers], {
			excludeLandmarks: false,
			mergeRareLandmarkClusters: true,
			landmarkRarityThreshold: 0.25,
			landmarkGateSimilarityThreshold: 0.5,
		});

		expect(result[0]).toBe(result[1]);
	});

	test("mergeRareLandmarkClusters does not let a shared landmark's own markup count as body-content evidence, even when excludeLandmarks: false (regression test for gate independence)", () => {
		// A bulky 8-element rare header, identical on both pages, plus main
		// content that is completely disjoint between the two pages. With
		// excludeLandmarks: false, the *primary* clustering tokenizes raw
		// HTML (header included) — but the merge gate must still judge
		// similarity on landmark-excised content only. If the header's own
		// tokens leaked into that judgment, shared header (8) vs disjoint
		// content (2 + 2) would score 8/12 ≈ 0.667, clearing the 0.5 gate
		// used here; on landmark-excised content alone the two pages share
		// nothing (0/4 = 0), so they must not merge.
		const rareHeader = `<header>${Array.from({ length: 8 }, (_, i) => `<i class="mark-${i}"></i>`).join('')}</header>`;
		const commonHeader = '<header><i class="mark-common"></i></header>';
		const pageA = {
			paths: ['dept-a', '1'],
			stylesheetHrefs: [],
			html: `<body>${rareHeader}<main><div class="only-in-a-1"></div><div class="only-in-a-2"></div></main></body>`,
		};
		const pageB = {
			paths: ['dept-b', '1'],
			stylesheetHrefs: [],
			html: `<body>${rareHeader}<main><div class="only-in-b-1"></div><div class="only-in-b-2"></div></main></body>`,
		};
		const fillers = Array.from({ length: 8 }, (_, i) => ({
			paths: ['dept-c', `${i}`],
			stylesheetHrefs: [],
			html: `<body>${commonHeader}<main><div class="filler-${i}"></div></main></body>`,
		}));

		const result = resolvePageClusterKeys([pageA, pageB, ...fillers], {
			excludeLandmarks: false,
			mergeRareLandmarkClusters: true,
			landmarkRarityThreshold: 0.25,
			landmarkGateSimilarityThreshold: 0.5,
		});

		expect(result[0]).not.toBe(result[1]);
	});
});

describe('resolvePageClusterKeys (local-landmark pseudo-token injection)', () => {
	test('pages that share a section-local landmark cluster separately from block siblings that lack it', () => {
		// Regression scenario mirroring the real-crawl section-local nav
		// case documented in the extract-landmarks JSDoc: a subset of pages
		// in one block carries an in-<main> section-local <nav> that the
		// other pages in the same block don't. Under excludeLandmarks: true
		// (default) the local nav is excised from remainderHtml, so
		// without pseudo-token injection Stage A would see identical
		// content across all pages and merge them. With injection, the
		// shared local-nav signature contributes a distinct pseudo-token
		// to the section pages, splitting them off.
		const withLocalNav = Array.from({ length: 4 }, (_, i) => ({
			paths: ['articles', `with-${i}`],
			stylesheetHrefs: [],
			html:
				'<body>' +
				'<header><nav>global</nav></header>' +
				'<main>' +
				'<nav class="section-local-nav"><a>Section</a></nav>' +
				'<article><h1>title</h1><p>body</p></article>' +
				'</main>' +
				'</body>',
		}));
		const withoutLocalNav = Array.from({ length: 6 }, (_, i) => ({
			paths: ['articles', `without-${i}`],
			stylesheetHrefs: [],
			html:
				'<body>' +
				'<header><nav>global</nav></header>' +
				'<main><article><h1>title</h1><p>body</p></article></main>' +
				'</body>',
		}));
		const result = resolvePageClusterKeys([...withLocalNav, ...withoutLocalNav]);
		// All four with-nav pages share a cluster key; all six without-nav
		// pages share a different cluster key.
		const withKey = result[0]!;
		const withoutKey = result[4]!;
		expect(withKey).not.toBe(withoutKey);
		for (let i = 0; i < 4; i++) expect(result[i]).toBe(withKey);
		for (let i = 4; i < 10; i++) expect(result[i]).toBe(withoutKey);
	});

	test('a singleton local landmark on one page does not fragment the block via pseudo-token injection', () => {
		// The `count >= 2` gate in computeLocalLandmarkPseudoTokens keeps
		// per-page unique landmark signatures from injecting a distinctive
		// token that would spuriously split the outlier off its siblings.
		// This is deliberate: real crawls include one-off editorial widgets
		// that shouldn't reshape clustering.
		const outlier = {
			paths: ['articles', 'outlier'],
			stylesheetHrefs: [],
			html:
				'<body>' +
				'<header><nav>global</nav></header>' +
				'<main><nav class="one-off-widget">unique</nav>' +
				'<article><h1>title</h1><p>body</p></article></main>' +
				'</body>',
		};
		const siblings = Array.from({ length: 9 }, (_, i) => ({
			paths: ['articles', `s-${i}`],
			stylesheetHrefs: [],
			html:
				'<body>' +
				'<header><nav>global</nav></header>' +
				'<main><article><h1>title</h1><p>body</p></article></main>' +
				'</body>',
		}));
		const result = resolvePageClusterKeys([outlier, ...siblings]);
		expect(result[0]).toBe(result[1]);
	});

	test('a global chrome signature (auto-cut cluster) does not inject a pseudo-token', () => {
		// Every page shares the same site-wide <header>. That signature's
		// corpus frequency is 1.0, at or above autoCutThreshold's clamp of
		// 0.8, so it's classified as global chrome and no pseudo-token is
		// emitted. Two content-equivalent pages therefore end up in one
		// cluster (no spurious per-page or per-block pseudo-token
		// discrimination from the shared chrome).
		const pages = Array.from({ length: 6 }, (_, i) => ({
			paths: ['articles', `p-${i}`],
			stylesheetHrefs: [],
			html:
				'<body>' +
				'<header><nav>global</nav></header>' +
				'<main><article><p>body</p></article></main>' +
				'</body>',
		}));
		const result = resolvePageClusterKeys(pages);
		for (let i = 1; i < 6; i++) expect(result[i]).toBe(result[0]);
	});
});
