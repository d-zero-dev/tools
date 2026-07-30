import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
	MAIN_CONTENT_FALLBACK_SELECTORS,
	MAIN_CONTENT_SELECTORS,
} from '@d-zero/beholder';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { captureLayoutTree } from './capture-layout-tree.js';
import { classifyLayoutTree } from './classify-layout-tree.js';

const FIXTURES_DIR = fileURLToPath(new URL('__fixtures__/', import.meta.url));

/**
 * Loads one fixture HTML file and wires up the same `getBoundingClientRect`
 * shim as `capture-layout-tree.spec.ts`, reading pixel geometry off each
 * element's `data-rect="x,y,width,height"` attribute — see that file's
 * `createDocument` for why this is a data-driven substitute for jsdom's
 * (nonexistent) layout engine rather than an attempt to reproduce it.
 * @param name
 */
function loadFixtureDocument(name: string): Document {
	const html = readFileSync(`${FIXTURES_DIR}${name}`, 'utf8');
	const { window } = new JSDOM(html, { url: 'https://example.com/' });
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

/**
 * @param fixtureName
 */
function classifyFixture(fixtureName: string) {
	const doc = loadFixtureDocument(fixtureName);
	const { root } = captureLayoutTree(
		null,
		MAIN_CONTENT_SELECTORS,
		MAIN_CONTENT_FALLBACK_SELECTORS,
		10,
		doc,
	);
	if (!root) {
		throw new Error(`fixture ${fixtureName} did not resolve a main element`);
	}
	return classifyLayoutTree(root);
}

describe('capture + classify integration (fixture HTML end-to-end)', () => {
	it('classifies stacked paragraphs as vertical-stack', () => {
		expect(classifyFixture('vertical-stack.html').layoutType).toBe('vertical-stack');
	});

	it('classifies three same-row cards as horizontal-row', () => {
		expect(classifyFixture('horizontal-row.html').layoutType).toBe('horizontal-row');
	});

	it('classifies a uniform 3x2 card grid as simple-grid', () => {
		const block = classifyFixture('simple-grid.html');
		expect(block.layoutType).toBe('simple-grid');
		expect(block.children).toHaveLength(6);
	});

	it('classifies a grid with a full-width banner row as complex-grid', () => {
		expect(classifyFixture('complex-grid.html').layoutType).toBe('complex-grid');
	});

	it('classifies a <table> as table', () => {
		expect(classifyFixture('table.html').layoutType).toBe('table');
	});

	it('classifies a floated image with wrapping text as float-wrap', () => {
		expect(classifyFixture('float-wrap.html').layoutType).toBe('float-wrap');
	});
});
