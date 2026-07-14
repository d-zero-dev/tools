import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { extractLandmarks } from './extract-landmarks.js';
import { tokenize } from './tokenize.js';

const EMPTY_LANDMARKS = {
	header: [] as string[],
	footer: [] as string[],
	nav: [] as string[],
	aside: [] as string[],
	form: [] as string[],
	search: [] as string[],
};

describe('extractLandmarks (basic extraction)', () => {
	test('matches the exact output documented in the JSDoc @example', () => {
		// Kept in sync with extractLandmarks's @example: if this ever fails,
		// the JSDoc example is out of date and must be corrected alongside the
		// implementation, not the other way around.
		const result = extractLandmarks(
			'<body><header>H</header><main>M</main><footer>F</footer></body>',
		);
		expect(result).toStrictEqual({
			...EMPTY_LANDMARKS,
			header: ['<header>H</header>'],
			footer: ['<footer>F</footer>'],
			remainderHtml: '<body><main>M</main></body>',
		});
	});

	test('a nav is extracted and removed the same way as header/footer', () => {
		const result = extractLandmarks('<body><nav>N</nav><main>M</main></body>');
		expect(result.nav).toStrictEqual(['<nav>N</nav>']);
		expect(result.remainderHtml).toBe('<body><main>M</main></body>');
	});

	test('an aside is extracted and removed the same way as header/footer', () => {
		const result = extractLandmarks('<body><aside>A</aside><main>M</main></body>');
		expect(result.aside).toStrictEqual(['<aside>A</aside>']);
		expect(result.remainderHtml).toBe('<body><main>M</main></body>');
	});

	test('a <search> element is extracted as the search landmark', () => {
		const result = extractLandmarks(
			'<body><search><input type="search"/></search><main>M</main></body>',
		);
		expect(result.search).toStrictEqual(['<search><input type="search"/></search>']);
		expect(result.remainderHtml).toBe('<body><main>M</main></body>');
	});

	test('role=form is extracted as the form landmark (bare <form> without role is not)', () => {
		const withRole = extractLandmarks(
			'<body><form role="form"><input/></form><main>M</main></body>',
		);
		expect(withRole.form).toStrictEqual(['<form role="form"><input/></form>']);
		expect(withRole.remainderHtml).toBe('<body><main>M</main></body>');

		const bareForm = extractLandmarks('<body><form><input/></form><main>M</main></body>');
		expect(bareForm.form).toStrictEqual([]);
		expect(bareForm.remainderHtml).toBe(
			'<body><form><input/></form><main>M</main></body>',
		);
	});

	test('role=search on a <form> is extracted as the search landmark', () => {
		const result = extractLandmarks(
			'<body><form role="search"><input/></form><main>M</main></body>',
		);
		expect(result.search).toStrictEqual(['<form role="search"><input/></form>']);
		expect(result.remainderHtml).toBe('<body><main>M</main></body>');
	});

	test('a page with no landmarks returns all fields as empty arrays and an unchanged remainderHtml', () => {
		const html = '<body><main>only content</main></body>';
		expect(extractLandmarks(html)).toStrictEqual({
			...EMPTY_LANDMARKS,
			remainderHtml: html,
		});
	});

	test('no <body> at all leaves remainderHtml unchanged and every field as an empty array', () => {
		const html = '<html><head><title>x</title></head></html>';
		expect(extractLandmarks(html)).toStrictEqual({
			...EMPTY_LANDMARKS,
			remainderHtml: html,
		});
	});
});

describe('extractLandmarks (role-based matching)', () => {
	test('role=banner is treated as a header even without a <header> tag', () => {
		const result = extractLandmarks(
			'<body><div role="banner">H</div><main>M</main></body>',
		);
		expect(result.header).toStrictEqual(['<div role="banner">H</div>']);
		expect(result.footer).toStrictEqual([]);
	});

	test('an element matching both a tag and a role is captured under both types', () => {
		// <header role="navigation">: a header by tag, a nav by role — both are
		// independently correct answers about the same physical element.
		// Identical spans are preserved under both types by keepOutermost
		// (strict containment only drops a match; identical spans are not
		// strictly contained by each other).
		const html = '<body><header role="navigation">HN</header><main>M</main></body>';
		const result = extractLandmarks(html);
		expect(result.header).toStrictEqual(['<header role="navigation">HN</header>']);
		expect(result.nav).toStrictEqual(['<header role="navigation">HN</header>']);
		// Excising the single matched span once, not twice.
		expect(result.remainderHtml).toBe('<body><main>M</main></body>');
	});

	test('a role=banner on <body> itself is recognized (the whole page becomes the header)', () => {
		// A degenerate but legitimate reading of role=banner directly on
		// <body>: the entire page is the banner, so the header span covers
		// all of it and remainderHtml is left empty. Pinned so this doesn't
		// silently regress to "body's own role is never checked" again.
		const html = '<body role="banner"><main>M</main></body>';
		const result = extractLandmarks(html);
		expect(result.header).toStrictEqual([html]);
		expect(result.remainderHtml).toBe('');
	});
});

describe('extractLandmarks (multiple instances of the same type)', () => {
	test('every non-nested <header> is captured in document order (no shallowest-wins filtering)', () => {
		// Pre-change, only the shallowest header was returned and the deeper
		// one was silently dropped as "page content, not chrome". Real crawl
		// data proved that heuristic wrong for section-local chrome, so we
		// now hand every instance to downstream frequency analysis (see
		// extract-landmarks.ts JSDoc "Why collect every instance").
		const html =
			'<body><main><article><header>Article H</header></article></main><header>Site H</header></body>';
		const result = extractLandmarks(html);
		expect(result.header).toStrictEqual([
			'<header>Article H</header>',
			'<header>Site H</header>',
		]);
		expect(result.remainderHtml).toBe('<body><main><article></article></main></body>');
	});

	test('a page with 11 headers preserves every non-nested one', () => {
		// Real production data had a page with 11 <header> elements. Under
		// the new contract they must all survive extraction — the
		// downstream corpus/unit frequency filter decides which are chrome.
		const siblings = Array.from(
			{ length: 10 },
			(_, i) => `<header>sibling-${i}</header>`,
		).join('');
		const html = `<body><header>outer</header>${siblings}</body>`;
		const result = extractLandmarks(html);
		expect(result.header).toHaveLength(11);
		expect(result.header[0]).toBe('<header>outer</header>');
		expect(result.header[10]).toBe('<header>sibling-9</header>');
	});
});

describe('extractLandmarks (nested landmark spans)', () => {
	test('a nav strictly inside a header is dropped from `nav` to prevent double-counting', () => {
		// Both would-be-matches share markup: keeping both would let shell-
		// token histograms count the nav's tokens once as the header's inner
		// content and once as the nav itself, skewing chrome detection.
		// keepOutermost drops the inner nav; the outer header carries the
		// nav's markup as part of its own span.
		const html = '<body><header>H<nav>N</nav>after-nav</header><main>M</main></body>';
		const result = extractLandmarks(html);
		expect(result.header).toStrictEqual(['<header>H<nav>N</nav>after-nav</header>']);
		expect(result.nav).toStrictEqual([]);
		expect(result.remainderHtml).toBe('<body><main>M</main></body>');
	});

	test('a header and a footer, with a nav nested only in the footer, both excise correctly', () => {
		const html =
			'<body><header>H</header><main>M</main><footer>F<nav>N</nav></footer></body>';
		const result = extractLandmarks(html);
		expect(result.header).toStrictEqual(['<header>H</header>']);
		expect(result.footer).toStrictEqual(['<footer>F<nav>N</nav></footer>']);
		expect(result.nav).toStrictEqual([]);
		expect(result.remainderHtml).toBe('<body><main>M</main></body>');
	});
});

describe('extractLandmarks (fold side effect on remainderHtml, documented and pinned)', () => {
	test('removing a landmark can make its class-less sibling wrapper fold-eligible once remainderHtml is tokenized', () => {
		// Before removal: the wrapper div has 2 element children (header, main)
		// and keeps its own segment. After removal: 1 child (main) — the
		// wrapper becomes fold-eligible (class-less div) and disappears from
		// the tokenized path. This is the documented, accepted side effect,
		// not a bug — pinned here so a future change can't silently alter it.
		const html = '<body><div><header>H</header><main>content</main></div></body>';
		const { remainderHtml } = extractLandmarks(html);
		expect(remainderHtml).toBe('<body><div><main>content</main></div></body>');
		expect(tokenize(remainderHtml).tokens).toStrictEqual(['body>main']);
		// Confirms the "before" side of the same claim: with the header still
		// present, the wrapper does NOT fold (2 children).
		expect(tokenize(html).tokens).toStrictEqual(['body>div>header', 'body>div>main']);
	});
});

describe('extractLandmarks (remainderHtml tokenizes to content-only tokens)', () => {
	test('tokenizing remainderHtml yields no header/footer/nav-derived tokens', () => {
		const html =
			'<body><header class="site-header"><nav class="site-nav"><a href="/">Home</a></nav></header>' +
			'<main><article><h1>Title</h1><p>Body text</p></article></main>' +
			'<footer class="site-footer"><p>Copyright</p></footer></body>';
		const { remainderHtml } = extractLandmarks(html);
		const tokens = tokenize(remainderHtml).tokens;
		expect(tokens).toStrictEqual(['body>main>article>h1', 'body>main>article>p']);
	});

	test('a section-local <nav> inside <main> is extracted (no depth-based silent demotion)', () => {
		// Pre-change, this nav would be silently classified as content because
		// it isn't the shallowest nav. That misclassification made
		// section-local chrome (real example: /company/ subtree with a local
		// nav absent elsewhere) invisible to shell detection. Now the nav is
		// extracted and remainderHtml carries only the true article content.
		const html =
			'<body><nav>global</nav>' +
			'<main><nav class="local">local menu</nav><article>body</article></main></body>';
		const result = extractLandmarks(html);
		expect(result.nav).toStrictEqual([
			'<nav>global</nav>',
			'<nav class="local">local menu</nav>',
		]);
		expect(result.remainderHtml).toBe(
			'<body><main><article>body</article></main></body>',
		);
	});
});

describe('extractLandmarks (opaque tags suppress landmark detection inside them)', () => {
	test('a header-like tag nested inside <svg> is not treated as a landmark', () => {
		const html = '<body><svg><header>fake</header></svg><main>M</main></body>';
		const result = extractLandmarks(html);
		expect(result.header).toStrictEqual([]);
		expect(result.remainderHtml).toBe(html);
	});

	test('a self-nested opaque tag (<svg> inside <svg>) does not leave stale state that blocks a later real header', () => {
		const html = '<body><svg><svg></svg></svg><header>H</header><main>M</main></body>';
		const result = extractLandmarks(html);
		expect(result.header).toStrictEqual(['<header>H</header>']);
		expect(result.remainderHtml).toBe(
			'<body><svg><svg></svg></svg><main>M</main></body>',
		);
	});
});

describe('extractLandmarks (malformed HTML)', () => {
	test('depth calculation is unaffected by stray nested <body> tags (production-scale fixture)', () => {
		const fixturePath = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			'__fixtures__',
			'production-scale',
			'adversarial-scale',
			'nested-body-tags-malformed.html',
		);
		const html = fs.readFileSync(fixturePath, 'utf8');
		const result = extractLandmarks(html);
		expect(result.header.join('')).toContain('MARKER_NESTED_BODY_TAGS_MALFORMED');
		expect(result.remainderHtml).not.toContain('MARKER_NESTED_BODY_TAGS_MALFORMED');
		expect(result.remainderHtml).toContain(
			'Main content that appears after multiple malformed body tags.',
		);
	});

	test('an unclosed landmark tag is discarded rather than swallowing the rest of the document', () => {
		// No </header> anywhere in this markup. htmlparser2 still fires a
		// close event for it (forced by the mismatched </body>), but reports
		// that close at </body>'s own position, not any position derived
		// from </header> — trusting it would slice "Real content" and the
		// literal </body> tag into the header field, corrupting
		// remainderHtml. Safety (never corrupt remainderHtml) wins over
		// completeness (detecting this malformed header) here.
		const html = '<body><header>H<main><article>Real content</article></main></body>';
		const result = extractLandmarks(html);
		expect(result.header).toStrictEqual([]);
		expect(result.remainderHtml).toBe(html);
	});

	test('a self-closed non-void tag (<header/>, ignored by HTML5 parsers) is discarded the same way', () => {
		// HTML5 parsing rules ignore the trailing "/" on a non-void element, so
		// <header/> opens a header that's never actually closed — the same
		// underlying hazard as a plain unclosed tag, reached a different way.
		const html = '<body><header/>Real content here</body>';
		const result = extractLandmarks(html);
		expect(result.header).toStrictEqual([]);
		expect(result.remainderHtml).toBe(html);
	});

	test('a role-bearing element whose tag name contains regex metacharacters does not crash the genuine-close check', () => {
		// htmlparser2 tolerates tag names outside the normal alphanumeric set
		// (e.g. an unencoded "(" in markup produces a tag literally named
		// "div(foo") — an unescaped tag name interpolated into a RegExp can
		// throw ("Unterminated group") on unbalanced metacharacters like this.
		const html = '<body><div(foo role="banner">H</div(foo><main>M</main></body>';
		expect(() => extractLandmarks(html)).not.toThrow();
		const result = extractLandmarks(html);
		expect(result.header).toStrictEqual(['<div(foo role="banner">H</div(foo>']);
		expect(result.remainderHtml).toBe('<body><main>M</main></body>');
	});

	test('a discarded malformed candidate does not block a well-formed candidate of the same type from being kept', () => {
		// The outer <header> is unclosed and thus discarded. Under the new
		// contract, the inner well-formed header is captured and every non-
		// nested match of a type is preserved — same guarantee as the
		// "multiple instances" tests above, just applied post-discard.
		const html =
			'<body><header>Outer malformed<main><header>Inner OK</header></main></body>';
		const result = extractLandmarks(html);
		expect(result.header).toStrictEqual(['<header>Inner OK</header>']);
		expect(result.remainderHtml).toBe(
			'<body><header>Outer malformed<main></main></body>',
		);
	});
});
