import { describe, expect, test } from 'vitest';

import { capContentDepth } from './cap-content-depth.js';

describe('capContentDepth', () => {
	test('matches the exact output documented in the JSDoc @example', () => {
		// Kept in sync with capContentDepth's @example: if this ever fails, the
		// JSDoc example is out of date and must be corrected alongside the
		// implementation, not the other way around.
		const result = capContentDepth(
			'<body><main><div><div><div><div>too deep</div></div></div></div></main></body>',
			{ landmark: 'main', maxDepth: 2 },
		);
		expect(result).toStrictEqual({
			remainderHtml: '<body><main><div><div></div></div></main></body>',
		});
	});

	test('content shallower than maxDepth is left completely unchanged', () => {
		const html = '<body><main><div><p>shallow</p></div></main></body>';
		expect(capContentDepth(html, { landmark: 'main', maxDepth: 3 })).toStrictEqual({
			remainderHtml: html,
		});
	});

	test('role="main" is recognized even without a <main> tag', () => {
		const result = capContentDepth(
			'<body><div role="main"><div><div><div>deep</div></div></div></div></body>',
			{ landmark: 'main', maxDepth: 1 },
		);
		expect(result.remainderHtml).toBe('<body><div role="main"><div></div></div></body>');
	});

	test('a page with no <main> and no role="main" is left unchanged', () => {
		const html = '<body><p>no main here</p></body>';
		expect(capContentDepth(html, { landmark: 'main', maxDepth: 1 })).toStrictEqual({
			remainderHtml: html,
		});
	});

	test('<main> itself (its own opening and closing tags, including attributes) is always kept, even at maxDepth 0', () => {
		const result = capContentDepth(
			'<body><main class="detail"><div>content</div></main></body>',
			{ landmark: 'main', maxDepth: 0 },
		);
		expect(result.remainderHtml).toBe('<body><main class="detail"></main></body>');
	});

	test('multiple independent too-deep branches at the same level are each capped correctly', () => {
		const html =
			'<body><main><section><div><div>deep-a</div></div></section><section><div><div>deep-b</div></div></section></main></body>';
		const result = capContentDepth(html, { landmark: 'main', maxDepth: 2 });
		expect(result.remainderHtml).toBe(
			'<body><main><section><div></div></section><section><div></div></section></main></body>',
		);
	});

	test('multiple <main> elements (malformed markup): the shallowest one wins, matching extractLandmarks', () => {
		const html =
			'<body><div><main><div><div><div>deep</div></div></div></main></div><main><div><div><div>also-deep</div></div></div></main></body>';
		const result = capContentDepth(html, { landmark: 'main', maxDepth: 1 });
		// The second <main> (depth 0, direct child of body) is shallower than
		// the first (depth 1, nested inside a <div>), so it wins.
		expect(result.remainderHtml).toBe(
			'<body><div><main><div><div><div>deep</div></div></div></main></div><main><div></div></main></body>',
		);
	});

	test('content inside an opaque tag (script) is never counted toward depth or capped', () => {
		const html =
			'<body><main><div><script>var deep = { a: { b: { c: 1 } } };</script></div></main></body>';
		const result = capContentDepth(html, { landmark: 'main', maxDepth: 1 });
		expect(result.remainderHtml).toBe(html);
	});

	test('an unclosed too-deep element is left in place rather than corrupting the remainder', () => {
		// No closing </div> for the too-deep element before </main> arrives —
		// htmlparser2 force-closes it at a position that doesn't correspond to
		// any real closing tag for it, so isGenuineClose rejects the candidate
		// and it is not excised.
		const html = '<body><main><div><div>unclosed</main></body>';
		const result = capContentDepth(html, { landmark: 'main', maxDepth: 1 });
		expect(result.remainderHtml).toBe(html);
	});

	test.each([-1, 0.5, Number.NaN])(
		'rejects a maxDepth that is not a non-negative integer (%s)',
		(maxDepth) => {
			expect(() =>
				capContentDepth('<body><main></main></body>', { landmark: 'main', maxDepth }),
			).toThrow(RangeError);
		},
	);
});

describe('capContentDepth (content root)', () => {
	test('matches the exact output documented in the JSDoc @example for a content-root hint', () => {
		const result = capContentDepth(
			'<body><div id="main"><div><div><p>too deep</p></div></div></div></body>',
			{ contentRoot: { tagName: 'div', id: 'main' }, maxDepth: 2 },
		);
		expect(result).toStrictEqual({
			remainderHtml: '<body><div id="main"><div><div></div></div></div></body>',
		});
	});

	test('a hint on an element outside every built-in fallback anchors the cap', () => {
		const html = '<body><div id="page"><div><div><p>deep</p></div></div></div></body>';
		expect(
			capContentDepth(html, { contentRoot: { id: 'page' }, maxDepth: 1 }).remainderHtml,
		).toBe('<body><div id="page"><div></div></div></body>');
		// Without the hint there is no anchor at all, so nothing is capped.
		expect(capContentDepth(html, { maxDepth: 1 }).remainderHtml).toBe(html);
	});

	test('classList in the hint is a subset match against the element class attribute', () => {
		const html =
			'<body><div id="page" class="spc wide"><div><div>deep</div></div></div></body>';
		expect(
			capContentDepth(html, {
				contentRoot: { id: 'page', classList: ['spc'] },
				maxDepth: 1,
			}).remainderHtml,
		).toBe('<body><div id="page" class="spc wide"><div></div></div></body>');
		expect(
			capContentDepth(html, {
				contentRoot: { id: 'page', classList: ['spc', 'narrow'] },
				maxDepth: 1,
			}).remainderHtml,
		).toBe(html);
	});

	test('the hint wins over a real <main>; without the hint <main> is the root', () => {
		const html =
			'<body><main><div><div>a</div></div></main><div id="page"><div><div>b</div></div></div></body>';
		expect(
			capContentDepth(html, { contentRoot: { id: 'page' }, maxDepth: 1 }).remainderHtml,
		).toBe(
			'<body><main><div><div>a</div></div></main><div id="page"><div></div></div></body>',
		);
		expect(capContentDepth(html, { maxDepth: 1 }).remainderHtml).toBe(
			'<body><main><div></div></main><div id="page"><div><div>b</div></div></div></body>',
		);
	});

	test('a hint that matches nothing falls back to <main> instead of leaving the page uncapped', () => {
		const html = '<body><main><div><div>deep</div></div></main></body>';
		expect(
			capContentDepth(html, { contentRoot: { id: 'added-by-script' }, maxDepth: 1 })
				.remainderHtml,
		).toBe('<body><main><div></div></main></body>');
	});

	test('with no hint and no <main>, the built-in fallback list anchors the cap (#main)', () => {
		expect(
			capContentDepth('<body><div id="main"><div><div>deep</div></div></div></body>', {
				maxDepth: 1,
			}).remainderHtml,
		).toBe('<body><div id="main"><div></div></div></body>');
	});

	test('the built-in fallback list is tried in order: #main beats #content, and <main> beats both', () => {
		const withBoth =
			'<body><div id="content"><div><div>c</div></div></div><div id="main"><div><div>m</div></div></div></body>';
		expect(capContentDepth(withBoth, { maxDepth: 1 }).remainderHtml).toBe(
			'<body><div id="content"><div><div>c</div></div></div><div id="main"><div></div></div></body>',
		);
		const withMain =
			'<body><div id="main"><div><div>m</div></div></div><main><div><div>x</div></div></main></body>';
		expect(capContentDepth(withMain, { maxDepth: 1 }).remainderHtml).toBe(
			'<body><div id="main"><div><div>m</div></div></div><main><div></div></main></body>',
		);
	});

	test('a class-based fallback (.content) anchors the cap when no id-based one exists', () => {
		expect(
			capContentDepth(
				'<body><div class="wrap content"><div><div>d</div></div></div></body>',
				{
					maxDepth: 1,
				},
			).remainderHtml,
		).toBe('<body><div class="wrap content"><div></div></div></body>');
	});

	test('<body> is never the content root, even when it carries the hinted id', () => {
		const html = '<body id="main"><div><div>deep</div></div></body>';
		expect(
			capContentDepth(html, { contentRoot: { id: 'main' }, maxDepth: 1 }).remainderHtml,
		).toBe(html);
	});

	test('when the hinted element occurs twice, the shallowest one is the root', () => {
		const html =
			'<body><div id="page"><div><p>a</p></div></div><section><div id="page"><div><p>b</p></div></div></section></body>';
		expect(
			capContentDepth(html, { contentRoot: { id: 'page' }, maxDepth: 1 }).remainderHtml,
		).toBe(
			'<body><div id="page"><div></div></div><section><div id="page"><div><p>b</p></div></div></section></body>',
		);
	});
});

describe('capContentDepth (anchor priority across depths)', () => {
	test('a deeper hint still beats a shallower <main>', () => {
		const html =
			'<body><main><div><div>a</div></div></main><section><div id="page"><div><div>b</div></div></div></section></body>';
		expect(
			capContentDepth(html, { contentRoot: { id: 'page' }, maxDepth: 1 }).remainderHtml,
		).toBe(
			'<body><main><div><div>a</div></div></main><section><div id="page"><div></div></div></section></body>',
		);
	});

	test('a deeper #main still beats a shallower #content', () => {
		const html =
			'<body><div id="content"><div><div>c</div></div></div><section><div id="main"><div><div>m</div></div></div></section></body>';
		expect(capContentDepth(html, { maxDepth: 1 }).remainderHtml).toBe(
			'<body><div id="content"><div><div>c</div></div></div><section><div id="main"><div></div></div></section></body>',
		);
	});

	test('a hinted element nested inside <main> is the root, and so is <main> nested inside a hinted element', () => {
		const insideMain =
			'<body><main><div><div id="page"><div><div>x</div></div></div></div></main></body>';
		expect(
			capContentDepth(insideMain, { contentRoot: { id: 'page' }, maxDepth: 1 })
				.remainderHtml,
		).toBe('<body><main><div><div id="page"><div></div></div></div></main></body>');

		const mainInside =
			'<body><div id="page"><div><main><div><div>x</div></div></main></div></div></body>';
		expect(
			capContentDepth(mainInside, { contentRoot: { id: 'page' }, maxDepth: 2 })
				.remainderHtml,
		).toBe('<body><div id="page"><div><main></main></div></div></body>');
	});
});

describe('capContentDepth (each built-in fallback anchors the cap)', () => {
	test.each([
		['<div id="main"><div><div>x</div></div></div>', '<div id="main"><div></div></div>'],
		[
			'<div class="main"><div><div>x</div></div></div>',
			'<div class="main"><div></div></div>',
		],
		[
			'<div id="content"><div><div>x</div></div></div>',
			'<div id="content"><div></div></div>',
		],
		[
			'<div class="content"><div><div>x</div></div></div>',
			'<div class="content"><div></div></div>',
		],
		[
			'<div id="contents"><div><div>x</div></div></div>',
			'<div id="contents"><div></div></div>',
		],
		[
			'<div class="contents"><div><div>x</div></div></div>',
			'<div class="contents"><div></div></div>',
		],
		[
			'<div id="main-content"><div><div>x</div></div></div>',
			'<div id="main-content"><div></div></div>',
		],
		[
			'<div class="main-content"><div><div>x</div></div></div>',
			'<div class="main-content"><div></div></div>',
		],
		[
			'<div id="main_content"><div><div>x</div></div></div>',
			'<div id="main_content"><div></div></div>',
		],
		[
			'<div class="main_content"><div><div>x</div></div></div>',
			'<div class="main_content"><div></div></div>',
		],
		[
			'<div id="mainContent"><div><div>x</div></div></div>',
			'<div id="mainContent"><div></div></div>',
		],
		[
			'<div class="mainContent"><div><div>x</div></div></div>',
			'<div class="mainContent"><div></div></div>',
		],
	])('%s', (fragment, expected) => {
		expect(
			capContentDepth(`<body>${fragment}</body>`, { maxDepth: 1 }).remainderHtml,
		).toBe(`<body>${expected}</body>`);
	});
});
