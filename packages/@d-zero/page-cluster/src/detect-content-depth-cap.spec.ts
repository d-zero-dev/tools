import { describe, expect, test } from 'vitest';

import { detectContentDepthCap } from './detect-content-depth-cap.js';

describe('detectContentDepthCap', () => {
	test('finds the depth just before cluster count explodes: identical structure up to depth 3, unique content at depth 4', () => {
		// Depths 1-3 all fold to a single cluster (the wrapper up to <div> is
		// identical across every page); depth 4 introduces a page-unique
		// <span class="unique-N">, fragmenting all 20 pages apart.
		const pages = Array.from(
			{ length: 20 },
			(_, i) =>
				`<body><main><section><article><div><span class="unique-${i}">content</span></div></article></section></main></body>`,
		);

		expect(detectContentDepthCap(pages, { candidateDepths: [1, 2, 3, 4, 5] })).toBe(3);
	});

	test('pages with no distinguishing content at any depth (no knee) return the largest candidate depth, deliberately not capping', () => {
		const pages = Array.from(
			{ length: 10 },
			() => '<body><main><section><article>same</article></section></main></body>',
		);

		expect(detectContentDepthCap(pages, { candidateDepths: [1, 2, 3, 4] })).toBe(4);
	});

	test('an empty page list returns the largest candidate depth', () => {
		expect(detectContentDepthCap([], { candidateDepths: [1, 2, 3] })).toBe(3);
	});

	test('minKneeRatio raises the bar for what counts as a knee, so a milder jump is no longer recognized', () => {
		const pages = Array.from(
			{ length: 20 },
			(_, i) =>
				`<body><main><section><article><div><span class="unique-${i}">content</span></div></article></section></main></body>`,
		);

		// The default threshold (1.5x) recognizes the 20x jump at depth 4.
		const withDefault = detectContentDepthCap(pages, {
			candidateDepths: [1, 2, 3, 4, 5],
		});
		expect(withDefault).toBe(3);

		// An unreasonably high bar (100x) rejects even that jump, so no depth
		// is capped.
		const withHighBar = detectContentDepthCap(pages, {
			candidateDepths: [1, 2, 3, 4, 5],
			minKneeRatio: 100,
		});
		expect(withHighBar).toBe(5);
	});

	test('rejects an empty candidateDepths list', () => {
		expect(() => detectContentDepthCap([], { candidateDepths: [] })).toThrow(RangeError);
	});

	test('rejects a candidateDepths list that is not strictly ascending', () => {
		expect(() => detectContentDepthCap([], { candidateDepths: [3, 1, 2] })).toThrow(
			RangeError,
		);
		expect(() => detectContentDepthCap([], { candidateDepths: [1, 1, 2] })).toThrow(
			RangeError,
		);
	});

	test.each([1, 0, -1, Number.NaN])(
		'rejects an invalid minKneeRatio (%s)',
		(minKneeRatio) => {
			expect(() =>
				detectContentDepthCap([], { candidateDepths: [1, 2], minKneeRatio }),
			).toThrow(RangeError);
		},
	);

	test('forwards TokenizeOptions/ResolveStructuralClusterKeysOptions to every sweep, and a jump exactly at minKneeRatio still counts as a knee', () => {
		// pages 0/1 share every tag/structure and differ only in an
		// emotion-style noise class ("css-XXXXXX") on their deepest element;
		// page 2 is structurally unrelated to either and stays its own
		// cluster at every depth.
		const pages = [
			'<body><main><section><p class="css-1x2y3z">a</p></section></main></body>',
			'<body><main><section><p class="css-9z8y7x">a</p></section></main></body>',
			'<body><main><em>different</em></main></body>',
		];

		// At maxDepth 1, capContentDepth excises the <p> (and its class)
		// entirely on both page 0 and 1, so they're identical regardless of
		// filterNoiseClasses: cluster count is 2 ({0,1}, {2}) either way.
		// At maxDepth 2, <p> survives with its class:
		// - filterNoiseClasses: true (the default) strips the noise class, so
		//   0 and 1 are still identical -> cluster count stays 2 -> ratio 1,
		//   no knee -> falls through to the largest candidate depth.
		expect(detectContentDepthCap(pages, { candidateDepths: [1, 2] })).toBe(2);

		// - filterNoiseClasses: false keeps the class, so 0 and 1 now differ
		//   -> cluster count becomes 3 -> ratio 3/2 = 1.5, exactly the default
		//   minKneeRatio. If this ratio were rejected (the pre-fix `>`
		//   boundary bug) or the option weren't forwarded to the sweep's own
		//   tokenize() calls, this would still return 2.
		expect(
			detectContentDepthCap(pages, {
				candidateDepths: [1, 2],
				filterNoiseClasses: false,
			}),
		).toBe(1);
	});
});
