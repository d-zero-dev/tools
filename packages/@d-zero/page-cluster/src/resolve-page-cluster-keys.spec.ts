import { describe, expect, test } from 'vitest';

import { resolvePageClusterKeys } from './resolve-page-cluster-keys.js';

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
		// (`path:dept-a`, `path:dept-b`), so resolveStructuralClusterKeys is
		// called twice and both times labels its one page `cluster:0` —
		// regression test for the cross-block label-collision gap this
		// function exists to close.
		const html = '<body><header>H</header></body>';
		const result = resolvePageClusterKeys([
			{ paths: ['dept-a', 'page1'], stylesheetHrefs: [], html },
			{ paths: ['dept-b', 'page1'], stylesheetHrefs: [], html },
		]);

		expect(result[0]).not.toBe(result[1]);
	});

	test('a stylesheet-derived block and a path-derived block never collide even with identical local labels', () => {
		// dept-a's two pages share a distinctive stylesheet (css: key); dept-b's
		// lone page has no stylesheet at all and falls back to a path: key.
		// Both blocks' sole/first cluster is locally labeled `cluster:0`.
		const html = '<body><header>H</header></body>';
		const result = resolvePageClusterKeys([
			{
				paths: ['dept-a', 'page1'],
				stylesheetHrefs: ['https://example.com/a.css'],
				html,
			},
			{
				paths: ['dept-a', 'page2'],
				stylesheetHrefs: ['https://example.com/a.css'],
				html,
			},
			{ paths: ['dept-b', 'page1'], stylesheetHrefs: [], html },
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
});
