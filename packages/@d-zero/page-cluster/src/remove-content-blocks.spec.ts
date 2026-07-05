import { describe, expect, test } from 'vitest';

import { removeContentBlocks } from './remove-content-blocks.js';

describe('removeContentBlocks', () => {
	test('matches the exact output documented in the JSDoc @example', () => {
		// Kept in sync with removeContentBlocks's @example: if this ever fails,
		// the JSDoc example is out of date and must be corrected alongside the
		// implementation, not the other way around.
		const result = removeContentBlocks(
			'<body><main><div data-bgb="wysiwyg">free text</div><div data-bgb="image1">...</div></main></body>',
			{ blockAttribute: 'data-bgb' },
		);
		expect(result).toStrictEqual({ remainderHtml: '<body><main></main></body>' });
	});

	test('a page with no matching blocks returns an unchanged remainderHtml', () => {
		const html = '<body><main>only content</main></body>';
		expect(removeContentBlocks(html, { blockAttribute: 'data-bgb' })).toStrictEqual({
			remainderHtml: html,
		});
	});

	test('multiple non-nested blocks are all removed', () => {
		const html =
			'<body><div data-bgb="a">A</div><p>kept</p><div data-bgb="b">B</div></body>';
		const result = removeContentBlocks(html, { blockAttribute: 'data-bgb' });
		expect(result.remainderHtml).toBe('<body><p>kept</p></body>');
	});

	test('a block nested inside another matching block is removed as a single merged span', () => {
		const html =
			'<body><div data-bgb="outer">O<div data-bgb="inner">I</div></div><p>kept</p></body>';
		const result = removeContentBlocks(html, { blockAttribute: 'data-bgb' });
		expect(result.remainderHtml).toBe('<body><p>kept</p></body>');
	});

	test('an element with the block attribute set to an empty string still matches (presence, not value, is what counts)', () => {
		const html = '<body><div data-bgb="">B</div><p>kept</p></body>';
		const result = removeContentBlocks(html, { blockAttribute: 'data-bgb' });
		expect(result.remainderHtml).toBe('<body><p>kept</p></body>');
	});

	test('a different attribute value than blockAttribute is left untouched', () => {
		const html = '<body><div data-other="x">X</div></body>';
		expect(removeContentBlocks(html, { blockAttribute: 'data-bgb' })).toStrictEqual({
			remainderHtml: html,
		});
	});

	test('content outside <body> is left untouched even if it carries the block attribute', () => {
		const html = '<html><head data-bgb="x">H</head><body><main>M</main></body></html>';
		const result = removeContentBlocks(html, { blockAttribute: 'data-bgb' });
		expect(result.remainderHtml).toBe(html);
	});

	test('a second top-level <body> (malformed markup) is ignored, same as extractLandmarks', () => {
		const html =
			'<body><main data-bgb="x">M</main></body><body><div data-bgb="y">Y</div></body>';
		const result = removeContentBlocks(html, { blockAttribute: 'data-bgb' });
		expect(result.remainderHtml).toBe(
			'<body></body><body><div data-bgb="y">Y</div></body>',
		);
	});

	test('a matching attribute inside an opaque tag (svg) is not searched', () => {
		const html = '<body><svg><rect data-bgb="x"></rect></svg><p>kept</p></body>';
		const result = removeContentBlocks(html, { blockAttribute: 'data-bgb' });
		expect(result.remainderHtml).toBe(html);
	});

	test('an opaque tag (svg) that is itself the block root (carries the attribute directly) is removed', () => {
		const html = '<body><svg data-bgb="chart">chart markup</svg><p>kept</p></body>';
		const result = removeContentBlocks(html, { blockAttribute: 'data-bgb' });
		expect(result.remainderHtml).toBe('<body><p>kept</p></body>');
	});

	test('<body> itself carrying the block attribute is not removed (unlike extractLandmarks, the whole page can never be "a content block")', () => {
		const html = '<body data-bgb="page-type"><main>keep me</main></body>';
		const result = removeContentBlocks(html, { blockAttribute: 'data-bgb' });
		expect(result.remainderHtml).toBe(html);
	});

	test('an unclosed matching element is discarded rather than corrupting the remainder', () => {
		// No closing </div> for the data-bgb element before <p> arrives —
		// htmlparser2 force-closes it at a position that doesn't correspond to
		// any real closing tag for it, so isGenuineClose rejects the candidate.
		const html = '<body><div data-bgb="x">X<p>kept</p></body>';
		const result = removeContentBlocks(html, { blockAttribute: 'data-bgb' });
		expect(result.remainderHtml).toBe(html);
	});
});
