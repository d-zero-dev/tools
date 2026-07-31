import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { captureLayoutTree } from './capture-layout-tree.js';

const SELECTORS = ['main', '#main', '.main'];
const FALLBACK_SELECTORS = ['[id*="main" i]'];

/**
 * Builds a `Document` whose `getBoundingClientRect` reads pixel geometry
 * off a `data-rect="x,y,width,height"` attribute instead of running jsdom's
 * (nonexistent) layout engine. This is the "monkeypatch to inject
 * pseudo-coordinates" from the plan — it validates that rect data flows
 * from element to `RawLayoutNode` correctly, not that any real browser's
 * layout algorithm is reproduced.
 * @param html
 */
function createDocument(html: string): Document {
	const dom = new JSDOM(html, { url: 'https://example.com/' });
	const { window } = dom;
	window.Element.prototype.getBoundingClientRect = function (this: Element) {
		const raw = this.dataset.rect;
		const [x, y, width, height] = raw ? raw.split(',').map(Number) : [0, 0, 0, 0];
		return {
			x: x!,
			y: y!,
			width: width!,
			height: height!,
			top: y!,
			left: x!,
			right: x! + width!,
			bottom: y! + height!,
			toJSON() {
				return this;
			},
		} as DOMRect;
	};
	return window.document;
}

describe('captureLayoutTree', () => {
	it('returns null selector and null root when no main element resolves', () => {
		const doc = createDocument('<body><div>No main</div></body>');

		const result = captureLayoutTree(null, SELECTORS, FALLBACK_SELECTORS, 10, doc);

		expect(result).toEqual({ mainSelector: null, root: null });
	});

	it('resolves <main> via the priority selector list', () => {
		const doc = createDocument(
			'<body><main id="page" data-rect="0,0,800,600"><p data-rect="0,0,100,20">Hi</p></main></body>',
		);

		const result = captureLayoutTree(null, SELECTORS, FALLBACK_SELECTORS, 10, doc);

		expect(result.mainSelector).toBe('main#page');
		expect(result.root?.tagName).toBe('MAIN');
		expect(result.root?.children).toHaveLength(1);
		expect(result.root?.children[0]?.tagName).toBe('P');
	});

	it('prefers a higher-priority selector even when it matches later in DOM order', () => {
		const doc = createDocument(
			'<body><div class="main" data-rect="0,0,1,1">Wrong</div>' +
				'<main id="page" data-rect="0,0,800,600">Right</main></body>',
		);

		const result = captureLayoutTree(null, SELECTORS, FALLBACK_SELECTORS, 10, doc);

		expect(result.mainSelector).toBe('main#page');
	});

	it('prefers a nested higher-priority match over its lower-priority ancestor wrapper', () => {
		const doc = createDocument(
			'<body><div class="main" data-rect="0,0,800,600">' +
				'<p data-rect="0,0,100,20">breadcrumb</p>' +
				'<main id="page" data-rect="0,20,400,580">Real main</main>' +
				'<div id="aside" data-rect="400,20,400,580">Sidebar</div>' +
				'</div></body>',
		);

		const result = captureLayoutTree(null, SELECTORS, FALLBACK_SELECTORS, 10, doc);

		expect(result.mainSelector).toBe('main#page');
	});

	it('skips an invalid selector in the priority list and keeps trying the rest', () => {
		const doc = createDocument(
			'<body><main id="page" data-rect="0,0,800,600">Right</main></body>',
		);

		const result = captureLayoutTree(
			null,
			['[[[invalid', ...SELECTORS],
			FALLBACK_SELECTORS,
			10,
			doc,
		);

		expect(result.mainSelector).toBe('main#page');
	});

	it('prefers the earlier-listed selector when two selectors both match different elements', () => {
		const doc = createDocument(
			'<body><div class="main" data-rect="0,0,1,1">Wrong</div>' +
				'<div id="main" data-rect="0,0,800,600">Right</div></body>',
		);

		const result = captureLayoutTree(null, SELECTORS, FALLBACK_SELECTORS, 10, doc);

		expect(result.mainSelector).toBe('div#main');
	});

	it('falls back to the fallback selector list when the priority list has no match', () => {
		const doc = createDocument(
			'<body><div id="primaryMain" data-rect="0,0,800,600">Fallback</div></body>',
		);

		const result = captureLayoutTree(null, SELECTORS, FALLBACK_SELECTORS, 10, doc);

		expect(result.mainSelector).toBe('div#primaryMain');
	});

	it('still returns DOM-order-first match among fallback selectors (fallback list is not priority-ordered per element)', () => {
		const doc = createDocument(
			'<body><div id="wrapperMain" data-rect="0,0,800,600">' +
				'<p data-rect="0,0,100,20">breadcrumb</p>' +
				'<div id="innerMain" data-rect="0,20,800,580">Inner</div>' +
				'</div></body>',
		);

		// Both #wrapperMain and #innerMain match the same fallback selector
		// (`[id*="main" i]`), so — unlike the priority list above — there is
		// no higher/lower priority to arbitrate between them. `querySelector`
		// returns whichever matches first in document order, which is the
		// outer wrapper here. This is accepted, existing behavior: the
		// priority-list fix only orders *between* selectors in the array,
		// not among multiple elements matching the *same* selector.
		const result = captureLayoutTree(null, SELECTORS, FALLBACK_SELECTORS, 10, doc);

		expect(result.mainSelector).toBe('div#wrapperMain');
	});

	it('tries the explicit mainContentSelector before the priority list', () => {
		const doc = createDocument(
			'<body><main data-rect="0,0,1,1">Wrong</main><section id="custom" data-rect="0,0,800,600">Right</section></body>',
		);

		const result = captureLayoutTree('#custom', SELECTORS, FALLBACK_SELECTORS, 10, doc);

		expect(result.mainSelector).toBe('section#custom');
	});

	it('reports each child box in coordinates relative to the parent box', () => {
		const doc = createDocument(
			'<body><main data-rect="10,20,800,600"><div data-rect="30,50,100,40"></div></main></body>',
		);

		const result = captureLayoutTree(null, SELECTORS, FALLBACK_SELECTORS, 10, doc);

		expect(result.root?.boundingBox).toEqual({ x: 0, y: 0, width: 800, height: 600 });
		expect(result.root?.children[0]?.boundingBox).toEqual({
			x: 20,
			y: 30,
			width: 100,
			height: 40,
		});
	});

	it('stops descending once captureMaxDepth is exhausted', () => {
		const doc = createDocument(
			'<body><main data-rect="0,0,100,100">' +
				'<div id="d1" data-rect="0,0,100,100">' +
				'<div id="d2" data-rect="0,0,100,100">' +
				'<div id="d3" data-rect="0,0,100,100"></div>' +
				'</div>' +
				'</div>' +
				'</main></body>',
		);

		// captureMaxDepth counts remaining descents from main itself: 2 allows
		// main -> d1 -> d2 (d2's own children, d3, are not walked).
		const result = captureLayoutTree(null, SELECTORS, FALLBACK_SELECTORS, 2, doc);

		const d1 = result.root?.children[0];
		expect(d1?.id).toBe('d1');
		const d2 = d1?.children[0];
		expect(d2?.id).toBe('d2');
		expect(d2?.children).toHaveLength(0);
	});

	it('does not descend into a hidden (display: none) subtree', () => {
		const doc = createDocument(
			'<body><main data-rect="0,0,100,100">' +
				'<div style="display: none" data-rect="0,0,0,0"><span data-rect="0,0,10,10"></span></div>' +
				'</main></body>',
		);

		const result = captureLayoutTree(null, SELECTORS, FALLBACK_SELECTORS, 10, doc);

		const hidden = result.root?.children[0];
		expect(hidden?.style.display).toBe('none');
		expect(hidden?.children).toHaveLength(0);
	});

	it('does not descend into an iframe', () => {
		const doc = createDocument(
			'<body><main data-rect="0,0,100,100"><iframe data-rect="0,0,50,50"></iframe></main></body>',
		);

		const result = captureLayoutTree(null, SELECTORS, FALLBACK_SELECTORS, 10, doc);

		expect(result.root?.children[0]?.tagName).toBe('IFRAME');
		expect(result.root?.children[0]?.children).toHaveLength(0);
	});

	it('captures raw style values verbatim without interpreting them', () => {
		const doc = createDocument(
			'<body><main data-rect="0,0,100,100"><div style="float: left; position: absolute;" data-rect="0,0,10,10"></div></main></body>',
		);

		const result = captureLayoutTree(null, SELECTORS, FALLBACK_SELECTORS, 10, doc);

		expect(result.root?.children[0]?.style).toEqual({
			display: 'block',
			float: 'left',
			position: 'absolute',
			visibility: 'visible',
		});
	});
});
