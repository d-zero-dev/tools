import { describe, expect, test } from 'vitest';

import { buildMirroredTemplateFixture } from './build-mirrored-template-fixture.js';

describe('buildMirroredTemplateFixture', () => {
	test('generates one page per (template, axis value, page index) combination', () => {
		const { pages, templates } = buildMirroredTemplateFixture();
		expect(templates).toHaveLength(8);
		expect(pages).toHaveLength(8 * 4 * 6);
	});

	test('respects custom axisValues and pagesPerTemplate', () => {
		const { pages } = buildMirroredTemplateFixture({
			axisValues: ['a', 'b'],
			pagesPerTemplate: 2,
		});
		expect(pages).toHaveLength(8 * 2 * 2);
		expect(new Set(pages.map((p) => p.axisValue))).toEqual(new Set(['a', 'b']));
	});

	test('every page carries its own axis-specific stylesheet href', () => {
		const { pages } = buildMirroredTemplateFixture({ axisValues: ['en', 'zh'] });
		for (const p of pages) {
			expect(
				p.signals.stylesheetHrefs.some((h) =>
					h.includes(`/${p.axisValue}/${p.template}/`),
				),
			).toBe(true);
		}
	});

	test('wrapperTag "main" and "div" wrap byte-identical inner content', () => {
		// Strips exactly the wrapper tag pair (not any other `<div>` in the
		// page — HEADER/FOOTER contain plenty). The wrapper's closing tag is
		// found by searching backward from `<footer`, since FOOTER (which
		// itself contains `</div>`) always immediately follows the wrapper.
		/**
		 *
		 * @param html
		 * @param open
		 * @param close
		 */
		function unwrap(html: string, open: string, close: string): string {
			const start = html.indexOf(open);
			const footerStart = html.indexOf('<footer');
			expect(start).toBeGreaterThanOrEqual(0);
			expect(footerStart).toBeGreaterThan(start);
			const end = html.lastIndexOf(close, footerStart);
			expect(end).toBeGreaterThan(start);
			return (
				html.slice(0, start) +
				html.slice(start + open.length, end) +
				html.slice(end + close.length)
			);
		}

		const withMain = buildMirroredTemplateFixture({ wrapperTag: 'main' });
		const withDiv = buildMirroredTemplateFixture({ wrapperTag: 'div' });
		expect(withMain.pages).toHaveLength(withDiv.pages.length);
		for (const [i, mainPage] of withMain.pages.entries()) {
			const divPage = withDiv.pages[i]!;
			const mainInner = unwrap(mainPage.signals.html, '<main>', '</main>');
			const divInner = unwrap(divPage.signals.html, '<div class="main-area">', '</div>');
			expect(mainInner).toBe(divInner);
		}
	});

	test('paths encode the axis value at a fixed segment position', () => {
		const { pages } = buildMirroredTemplateFixture({ axisValues: ['en', 'zh'] });
		for (const p of pages) {
			expect(p.signals.paths[0]).toBe(p.axisValue);
			expect(p.signals.paths[1]).toBe(p.template);
		}
	});
});
