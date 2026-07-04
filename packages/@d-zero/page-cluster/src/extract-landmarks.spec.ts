import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { extractLandmarks } from './extract-landmarks.js';
import { tokenize } from './tokenize.js';

describe('extractLandmarks (basic extraction)', () => {
	test('matches the exact output documented in the JSDoc @example', () => {
		// Kept in sync with extractLandmarks's @example: if this ever fails,
		// the JSDoc example is out of date and must be corrected alongside the
		// implementation, not the other way around.
		const result = extractLandmarks(
			'<body><header>H</header><main>M</main><footer>F</footer></body>',
		);
		expect(result).toStrictEqual({
			header: '<header>H</header>',
			footer: '<footer>F</footer>',
			remainderHtml: '<body><main>M</main></body>',
		});
	});

	test('a nav is extracted and removed the same way as header/footer', () => {
		const result = extractLandmarks('<body><nav>N</nav><main>M</main></body>');
		expect(result.nav).toBe('<nav>N</nav>');
		expect(result.remainderHtml).toBe('<body><main>M</main></body>');
	});

	test('an aside is extracted and removed the same way as header/footer', () => {
		const result = extractLandmarks('<body><aside>A</aside><main>M</main></body>');
		expect(result.aside).toBe('<aside>A</aside>');
		expect(result.remainderHtml).toBe('<body><main>M</main></body>');
	});

	test('a page with no landmarks returns all fields absent and an unchanged remainderHtml', () => {
		const html = '<body><main>only content</main></body>';
		expect(extractLandmarks(html)).toStrictEqual({ remainderHtml: html });
	});

	test('no <body> at all leaves remainderHtml unchanged and every field absent', () => {
		const html = '<html><head><title>x</title></head></html>';
		expect(extractLandmarks(html)).toStrictEqual({ remainderHtml: html });
	});
});

describe('extractLandmarks (role-based matching)', () => {
	test('role=banner is treated as a header even without a <header> tag', () => {
		const result = extractLandmarks(
			'<body><div role="banner">H</div><main>M</main></body>',
		);
		expect(result.header).toBe('<div role="banner">H</div>');
		expect(result.footer).toBeUndefined();
	});

	test('an element matching both a tag and a role is captured under both types', () => {
		// <header role="navigation">: a header by tag, a nav by role — both are
		// independently correct answers about the same physical element.
		const html = '<body><header role="navigation">HN</header><main>M</main></body>';
		const result = extractLandmarks(html);
		expect(result.header).toBe('<header role="navigation">HN</header>');
		expect(result.nav).toBe('<header role="navigation">HN</header>');
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
		expect(result.header).toBe(html);
		expect(result.remainderHtml).toBe('');
	});
});

describe('extractLandmarks (multiple instances of the same type)', () => {
	test('the shallower of two same-depth-unequal headers wins, regardless of document order', () => {
		// The nested header (inside <main>) appears first in the document but
		// is deeper (depth 2); the direct child of body (depth 1) appears
		// second but must still win.
		const html =
			'<body><main><header>Nested deep</header></main><header>Shallow</header></body>';
		const result = extractLandmarks(html);
		expect(result.header).toBe('<header>Shallow</header>');
	});

	test('at equal depth, the first header in document order wins', () => {
		const html = '<body><header>A</header><header>B</header></body>';
		const result = extractLandmarks(html);
		expect(result.header).toBe('<header>A</header>');
	});

	test('a page with 11 headers (real-world scale) still resolves to exactly one winner', () => {
		const nested = Array.from(
			{ length: 10 },
			(_, i) => `<header>nested-${i}</header>`,
		).join('');
		const html = `<body><header>shallow</header><main>${nested}</main></body>`;
		const result = extractLandmarks(html);
		expect(result.header).toBe('<header>shallow</header>');
	});
});

describe('extractLandmarks (nested landmark spans)', () => {
	test('a nav nested inside the winning header is excised as one merged span, not double-processed', () => {
		const html = '<body><header>H<nav>N</nav>after-nav</header><main>M</main></body>';
		const result = extractLandmarks(html);
		expect(result.header).toBe('<header>H<nav>N</nav>after-nav</header>');
		expect(result.nav).toBe('<nav>N</nav>');
		expect(result.remainderHtml).toBe('<body><main>M</main></body>');
	});

	test('header and footer with a nav nested in the footer both excise correctly', () => {
		const html =
			'<body><header>H</header><main>M</main><footer>F<nav>N</nav></footer></body>';
		const result = extractLandmarks(html);
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
});

describe('extractLandmarks (opaque tags suppress landmark detection inside them)', () => {
	test('a header-like tag nested inside <svg> is not treated as a landmark', () => {
		const html = '<body><svg><header>fake</header></svg><main>M</main></body>';
		const result = extractLandmarks(html);
		expect(result.header).toBeUndefined();
		expect(result.remainderHtml).toBe(html);
	});

	test('a self-nested opaque tag (<svg> inside <svg>) does not leave stale state that blocks a later real header', () => {
		const html = '<body><svg><svg></svg></svg><header>H</header><main>M</main></body>';
		const result = extractLandmarks(html);
		expect(result.header).toBe('<header>H</header>');
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
		expect(result.header).toContain('MARKER_NESTED_BODY_TAGS_MALFORMED');
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
		expect(result.header).toBeUndefined();
		expect(result.remainderHtml).toBe(html);
	});

	test('a self-closed non-void tag (<header/>, ignored by HTML5 parsers) is discarded the same way', () => {
		// HTML5 parsing rules ignore the trailing "/" on a non-void element, so
		// <header/> opens a header that's never actually closed — the same
		// underlying hazard as a plain unclosed tag, reached a different way.
		const html = '<body><header/>Real content here</body>';
		const result = extractLandmarks(html);
		expect(result.header).toBeUndefined();
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
		expect(result.header).toBe('<div(foo role="banner">H</div(foo>');
		expect(result.remainderHtml).toBe('<body><main>M</main></body>');
	});

	test('a discarded malformed candidate falls back to another well-formed candidate of the same type', () => {
		// The shallow, would-be-winning header is unclosed (malformed) and
		// discarded; a deeper, well-formed header is still picked up rather
		// than the type being left absent entirely.
		const html =
			'<body><header>Outer malformed<main><header>Inner OK</header></main></body>';
		const result = extractLandmarks(html);
		expect(result.header).toBe('<header>Inner OK</header>');
		expect(result.remainderHtml).toBe(
			'<body><header>Outer malformed<main></main></body>',
		);
	});
});
