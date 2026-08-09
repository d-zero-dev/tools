import type { LayoutAnalysisResult } from './types.js';

import { describe, expect, it } from 'vitest';

import { formatResultLine } from './format-output.js';

const NESTED_RESULT: LayoutAnalysisResult = {
	url: 'https://example.com/',
	viewport: { name: 'pc', width: 1280 },
	mainSelector: 'main',
	root: {
		layoutType: 'horizontal-row',
		tagName: 'DIV',
		id: 'root',
		classList: [],
		boundingBox: { x: 0, y: 0, width: 800, height: 100 },
		innerHTML: '<div>a</div><div>b</div>',
		confidence: 0.8,
		signals: { rowCount: 1 },
		children: [
			{
				layoutType: 'leaf',
				tagName: 'A',
				id: null,
				classList: [],
				boundingBox: { x: 0, y: 0, width: 100, height: 100 },
				innerHTML: 'a',
				attributes: { href: '/about/' },
				confidence: 0,
				signals: {},
				children: [],
			},
		],
	},
};

describe('formatResultLine', () => {
	it('emits single-line JSON by default', () => {
		const line = formatResultLine(NESTED_RESULT);
		expect(line).not.toContain('\n');
		expect(JSON.parse(line)).toMatchObject({
			url: 'https://example.com/',
			mainSelector: 'main',
		});
	});

	it('pretty-prints when requested', () => {
		const line = formatResultLine(NESTED_RESULT, { pretty: true });
		expect(line).toContain('\n');
	});

	it('includes boundingBox by default', () => {
		const parsed = JSON.parse(formatResultLine(NESTED_RESULT));
		expect(parsed.root.boundingBox).toEqual({ x: 0, y: 0, width: 800, height: 100 });
	});

	it('omits boundingBox when includeBoundingBox is false', () => {
		const parsed = JSON.parse(
			formatResultLine(NESTED_RESULT, { includeBoundingBox: false }),
		);
		expect(parsed.root.boundingBox).toBeUndefined();
		expect(parsed.root.children[0].boundingBox).toBeUndefined();
	});

	it('includes innerHTML on every block by default (mode "all")', () => {
		const parsed = JSON.parse(formatResultLine(NESTED_RESULT));
		expect(parsed.root.innerHTML).toBe('<div>a</div><div>b</div>');
		expect(parsed.root.children[0].innerHTML).toBe('a');
	});

	it('includes innerHTML only on leaves in "leaf-only" mode', () => {
		const parsed = JSON.parse(
			formatResultLine(NESTED_RESULT, { innerHtmlMode: 'leaf-only' }),
		);
		expect(parsed.root.innerHTML).toBeUndefined();
		expect(parsed.root.children[0].innerHTML).toBe('a');
	});

	it('omits innerHTML everywhere in "none" mode', () => {
		const parsed = JSON.parse(formatResultLine(NESTED_RESULT, { innerHtmlMode: 'none' }));
		expect(parsed.root.innerHTML).toBeUndefined();
		expect(parsed.root.children[0].innerHTML).toBeUndefined();
	});

	it('includes attributes on every block, defaulting to {} when absent', () => {
		const parsed = JSON.parse(formatResultLine(NESTED_RESULT));
		expect(parsed.root.attributes).toEqual({});
		expect(parsed.root.children[0].attributes).toEqual({ href: '/about/' });
	});

	it('renders a null root as null', () => {
		const result: LayoutAnalysisResult = {
			url: 'https://example.com/',
			viewport: { name: 'pc', width: 1280 },
			mainSelector: null,
			root: null,
		};
		const parsed = JSON.parse(formatResultLine(result));
		expect(parsed.root).toBeNull();
	});
});
