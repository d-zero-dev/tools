import type { Page } from 'puppeteer';

import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

import { extractMainContentsFromDocument, getMainContents } from './get-main-contents.js';

/**
 * @param html
 */
function createDocument(html: string): Document {
	return new JSDOM(html, { url: 'https://example.com/' }).window.document;
}

/**
 * @param html
 * @param mainContentSelector
 */
function extract(html: string, mainContentSelector: string | null = null) {
	return extractMainContentsFromDocument(mainContentSelector, createDocument(html));
}

describe('extractMainContentsFromDocument', () => {
	it('returns empty main metrics when no main content element is found, but counts body text', () => {
		const result = extract(
			'<html><head><title>T</title></head><body><header>ABC</header><div>No main</div></body></html>',
		);

		expect(result).toEqual({
			title: 'T',
			main: null,
			wordCount: 0,
			bodyWordCount: 9,
			headings: [],
			images: [],
			tables: [],
			buttons: [],
			iframes: [],
			videos: [],
			audios: [],
			canvases: [],
		});
	});

	it('detects <main> and counts word length', () => {
		const result = extract('<html><body><main>こんにちは世界</main></body></html>');

		expect(result.wordCount).toBe(7);
		expect(result.bodyWordCount).toBeGreaterThanOrEqual(7);
		expect(result.main?.nodeName).toBe('MAIN');
	});

	it('detects [role="main"]', () => {
		const result = extract('<html><body><div role="main">Content</div></body></html>');

		expect(result.wordCount).toBe(7);
		expect(result.main?.role).toBe('main');
	});

	it('uses custom mainContentSelector when provided', () => {
		const result = extract(
			'<html><body><section id="page-body">Custom main</section></body></html>',
			'#page-body',
		);

		expect(result.wordCount).toBe(10);
		expect(result.main?.id).toBe('page-body');
	});

	it('falls back to built-in selectors when custom selector is invalid', () => {
		const result = extract(
			'<html><body><main>Still works</main></body></html>',
			'[[[invalid',
		);

		expect(result.main?.nodeName).toBe('MAIN');
		expect(result.wordCount).toBe(10);
	});

	it('extracts headings from main content', () => {
		const result = extract(`
			<html><body><main>
				<h1>Title</h1>
				<h2>Subtitle</h2>
				<h3>Section</h3>
			</main></body></html>
		`);

		expect(result.headings).toEqual([
			{ text: 'Title', level: 1 },
			{ text: 'Subtitle', level: 2 },
			{ text: 'Section', level: 3 },
		]);
	});

	it('extracts images from main content', () => {
		const result = extract(`
			<html><body><main>
				<img src="a.png" alt="Image A">
				<img src="b.png" alt="Image B">
				<input type="image" src="c.png" alt="Image C">
			</main></body></html>
		`);

		expect(result.images).toHaveLength(3);
		expect(result.images[0]?.alt).toBe('Image A');
		expect(result.images[0]?.src).toContain('a.png');
	});

	it('extracts table metadata from main content', () => {
		const result = extract(`
			<html><body><main>
				<table>
					<thead><tr><th>A</th><th>B</th></tr></thead>
					<tfoot><tr><td>Footer</td><td></td></tr></tfoot>
					<tbody>
						<tr><td colspan="2">Merged</td></tr>
						<tr><td>1</td><td>2</td></tr>
					</tbody>
				</table>
			</main></body></html>
		`);

		expect(result.tables).toEqual([
			{
				rows: 4,
				cols: 2,
				hasHeader: true,
				hasFooter: true,
				hasMergedCell: true,
			},
		]);
	});

	it('extracts buttons from main content', () => {
		const result = extract(`
			<html><body><main>
				<button>Save</button>
				<a role="button" href="#">Go</a>
				<span class="btn">Click</span>
				<div class="share-button">Share</div>
			</main></body></html>
		`);

		expect(result.buttons).toHaveLength(4);
		expect(result.buttons[0]).toMatchObject({
			nodeName: 'BUTTON',
			text: 'Save',
			disabled: false,
		});
		expect(result.buttons[1]?.role).toBe('button');
	});

	it('extracts iframe, video, audio, and canvas from main content', () => {
		const result = extract(`
			<html><body><main>
				<iframe src="/embed" title="Embed" width="640" height="360"></iframe>
				<video src="/movie.mp4" poster="/poster.jpg" width="320" height="180"></video>
				<audio src="/sound.mp3"></audio>
				<canvas width="100" height="50"></canvas>
			</main></body></html>
		`);

		expect(result.iframes).toHaveLength(1);
		expect(result.iframes[0]).toMatchObject({
			title: 'Embed',
			width: '640',
			height: '360',
		});
		expect(result.iframes[0]?.src).toContain('/embed');

		expect(result.videos).toHaveLength(1);
		expect(result.videos[0]?.src).toContain('/movie.mp4');
		expect(result.videos[0]?.poster).toContain('/poster.jpg');
		expect(result.videos[0]?.width).toBe(320);
		expect(result.videos[0]?.height).toBe(180);

		expect(result.audios).toHaveLength(1);
		expect(result.audios[0]?.src).toContain('/sound.mp3');

		expect(result.canvases).toEqual([{ width: 100, height: 50 }]);
	});

	it('treats whitespace-only main text as zero word count', () => {
		const result = extract('<html><body><main>   \n\t  </main></body></html>');

		expect(result.wordCount).toBe(0);
	});

	it('detects #content fallback selector', () => {
		const result = extract(
			'<html><body><div id="content">Fallback content</div></body></html>',
		);

		expect(result.wordCount).toBe(15);
	});

	it('detects .main fallback selector', () => {
		const result = extract(
			'<html><body><div class="main">Class-based main</div></body></html>',
		);

		expect(result.wordCount).toBe(15);
	});

	it('returns first matching element in DOM order when multiple Phase-1 selectors match', () => {
		const result = extract(`
			<html><body>
				<main>Semantic main</main>
				<div id="content">ID content</div>
			</body></html>
		`);

		expect(result.main?.nodeName).toBe('MAIN');
		expect(result.wordCount).toBe(12);
	});

	it('uses Phase-2 class*=main when Phase-1 finds nothing', () => {
		const result = extract(
			'<html><body><div class="page-main-area">Phase two</div></body></html>',
		);

		expect(result.main?.classList).toContain('page-main-area');
		// "Phase two" → "Phasetwo" (8) after whitespace removal
		expect(result.wordCount).toBe(8);
	});

	it('uses Phase-2 id*=content case-insensitively when Phase-1 finds nothing', () => {
		const result = extract(
			'<html><body><div id="PrimaryContent">Primary</div></body></html>',
		);

		expect(result.main?.id).toBe('PrimaryContent');
		expect(result.wordCount).toBe(7);
	});

	it('prefers Phase-1 <main> over an earlier header-content that would match Phase-2', () => {
		const result = extract(`
			<html><body>
				<div class="header-content">Chrome</div>
				<main>Real main</main>
			</body></html>
		`);

		expect(result.main?.nodeName).toBe('MAIN');
		expect(result.wordCount).toBe(8);
	});

	it('may match class*=main on maintenance via Phase-2 (accepted false positive)', () => {
		const result = extract(
			'<html><body><div class="maintenance">Down</div></body></html>',
		);

		expect(result.main?.classList).toContain('maintenance');
		expect(result.wordCount).toBe(4);
	});

	it('builds a simple diagnostic selector from tag, id, and classes', () => {
		const result = extract(
			'<html><body><div id="page-body" class="foo bar" role="main">X</div></body></html>',
		);

		expect(result.main?.selector).toBe('div#page-body.foo.bar');
	});
});

describe('getMainContents', () => {
	it('passes only the selector into page.evaluate so Document defaults in the page realm', async () => {
		const evaluate = vi.fn(
			(fn: typeof extractMainContentsFromDocument, sel: string | null) =>
				Promise.resolve(
					fn(sel, createDocument('<html><body><main>Hi</main></body></html>')),
				),
		);
		const page = { evaluate } as unknown as Page;

		const result = await getMainContents(page, { mainContentSelector: '#x' });

		expect(evaluate).toHaveBeenCalledWith(extractMainContentsFromDocument, '#x');
		expect(result.wordCount).toBe(2);
	});
});
