import type { ContentRoot } from './types.js';

import { describe, expect, test } from 'vitest';

import { extractLandmarks } from './extract-landmarks.js';
import { stageAPerBlock } from './stage-a-per-block.js';

/**
 * A static-content page whose content root carries a per-page identity class
 * over an otherwise fixed skeleton. `wrap` and `block` recur on every page;
 * `label` occurs on this page only.
 * @param label
 */
function labeledPage(label: string): string {
	return (
		'<body><div class="wrap">' +
		`<article class="${label}"><h2>t</h2><section class="block"><p>x</p></section></article>` +
		'</div></body>'
	);
}

/**
 * Runs Stage A on one block built from `htmlList`, with no local-landmark
 * reinjection (empty sets), mirroring what the in-memory driver passes.
 * @param htmlList
 * @param contentRoots
 */
function runBlock(
	htmlList: readonly string[],
	contentRoots?: readonly (ContentRoot | undefined)[],
) {
	const landmarks = htmlList.map((html) => extractLandmarks(html));
	return stageAPerBlock({
		blockKey: 'path:section',
		memberIndices: htmlList.map((_, i) => i),
		preparedHtml: landmarks.map((l) => l.remainderHtml),
		landmarks,
		localLandmarkTokensByPage: htmlList.map(() => new Set<string>()),
		contentRoots,
	});
}

describe('stageAPerBlock (page-unique class stripping)', () => {
	test('at 10 pages, classes on a single page are excluded from allowedClasses and the pages cluster together', () => {
		const result = runBlock(
			Array.from({ length: 10 }, (_, i) => labeledPage(`page-${i}`)),
		);
		expect(result.allowedClasses).toStrictEqual(new Set(['wrap', 'block']));
		expect(new Set(result.pageKeys.values()).size).toBe(1);
		expect(result.crossBlockUnits).toHaveLength(1);
	});

	test('below 10 pages, allowedClasses is undefined and per-page labels keep every page apart', () => {
		const result = runBlock(
			Array.from({ length: 9 }, (_, i) => labeledPage(`page-${i}`)),
		);
		expect(result.allowedClasses).toBeUndefined();
		expect(new Set(result.pageKeys.values()).size).toBe(9);
	});

	test('a block where every class recurs still reports the full recurring set, not undefined', () => {
		// The streaming path applies this set to pages outside the sample;
		// `undefined` there would mean "keep every class" for those pages
		// while the sample had (vacuously) been filtered.
		const result = runBlock(Array.from({ length: 10 }, () => labeledPage('same')));
		expect(result.allowedClasses).toStrictEqual(new Set(['wrap', 'same', 'block']));
		expect(new Set(result.pageKeys.values()).size).toBe(1);
	});

	test('a class shared by exactly two pages is kept and still separates them from the rest', () => {
		// The shared variant is a plain <div>, not a landmark: landmarks are
		// excised from `preparedHtml` before Stage A and only come back via
		// the local-landmark reinjection the driver performs, which this
		// direct call leaves empty.
		const pages = [
			...Array.from({ length: 8 }, (_, i) => labeledPage(`page-${i}`)),
			...Array.from({ length: 2 }, (_, i) =>
				labeledPage(`note-${i}`).replace(
					'</article>',
					'</article><div class="with-note"><ul><li><a>x</a></li><li><a>y</a></li></ul><p>note</p></div>',
				),
			),
		];
		const result = runBlock(pages);
		expect(result.allowedClasses).toStrictEqual(new Set(['wrap', 'block', 'with-note']));
		const keys = [...result.pageKeys.values()];
		expect(new Set(keys.slice(0, 8)).size).toBe(1);
		expect(keys[8]).toBe(keys[9]);
		expect(keys[8]).not.toBe(keys[0]);
	});

	test('a single-page block is left untouched (no cap sweep, no stripping)', () => {
		const result = runBlock([labeledPage('only')]);
		expect(result.allowedClasses).toBeUndefined();
		expect([...result.pageKeys.values()]).toStrictEqual(['["path:section","cluster:0"]']);
	});
});

describe('stageAPerBlock (content root and block identity)', () => {
	/**
	 * Twelve pages under `<div id="page">` (not a built-in fallback), identical
	 * down to depth 3 and differing only in the tag at depth 4 — so they
	 * cluster together exactly when the cap at depth 3 is applied.
	 */
	const tags = [
		'em',
		'strong',
		'b',
		'i',
		'u',
		'code',
		'kbd',
		'samp',
		'var',
		'mark',
		'q',
		's',
	];
	const pages = tags.map(
		(tag) =>
			`<body><div id="page"><section><article><div><${tag}>x</${tag}></div></article></section></div></body>`,
	);

	test('per-page content roots anchor the cap: the block collapses to one cluster at the learned depth', () => {
		const result = runBlock(
			pages,
			pages.map(() => ({ id: 'page' })),
		);
		expect(result.maxMainDepth).toBe(3);
		expect(new Set(result.pageKeys.values()).size).toBe(1);
	});

	test('without content roots and without any built-in anchor nothing is capped and every distinct page stays apart', () => {
		const result = runBlock(pages);
		expect(result.maxMainDepth).toBe(10);
		expect(new Set(result.pageKeys.values()).size).toBe(12);
	});

	test('a single-page block runs no sweep and reports no depth', () => {
		expect(runBlock([pages[0]!], [{ id: 'page' }]).maxMainDepth).toBeUndefined();
	});

	test('every cross-block unit carries the block it came from', () => {
		const result = runBlock(
			pages,
			pages.map(() => ({ id: 'page' })),
		);
		expect(result.crossBlockUnits.map((unit) => unit.blockKey)).toStrictEqual([
			'path:section',
		]);
	});
});
