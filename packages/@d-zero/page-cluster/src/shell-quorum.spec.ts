import type { LandmarkType } from './extract-landmarks.js';
import type { PerPageLandmarkInstance } from './per-page-landmark-signatures.js';

import { describe, expect, test } from 'vitest';

import { shellQuorum } from './shell-quorum.js';

const DUMMY_POSITION = {
	startOffset: 0,
	endOffset: 0,
	startLine: 1,
	startColumn: 1,
	endLine: 1,
	endColumn: 1,
};

/**
 *
 * @param tokens
 * @param type
 */
function instance(
	tokens: readonly string[],
	type: LandmarkType = 'header',
): PerPageLandmarkInstance {
	return {
		type,
		tokens: new Set(tokens),
		signature: JSON.stringify(tokens.toSorted()),
		position: DUMMY_POSITION,
	};
}

describe('shellQuorum', () => {
	test('empty input returns an empty shell', () => {
		expect(shellQuorum([])).toStrictEqual(new Set());
	});

	test('every page with zero landmark instances yields an empty shell', () => {
		expect(shellQuorum([[], [], []])).toStrictEqual(new Set());
	});

	test('a single distinct token present on every page passes the fallback clamp', () => {
		// One distinct token → autoCutThreshold's `heights.length < 2` fallback
		// returns the clamp (0.8) verbatim. freq 1.0 >= 0.8 → shell.
		const perPage = Array.from({ length: 5 }, () => [instance(['a'])]);
		expect(shellQuorum(perPage)).toStrictEqual(new Set(['a']));
	});

	test('the JSDoc-documented gap distribution ({1.00,1.00,0.65,0.03,0.02}) splits shell from noise', () => {
		// Largest gap is between 0.65 and 0.03 (0.62) — cut lands at the
		// midpoint (0.34), grouping the 0.65 token with the two 1.00 tokens
		// as shell, and excluding the 0.03/0.02 tokens as page-specific noise.
		const pageCount = 100;
		const perPage: PerPageLandmarkInstance[][] = [];
		for (let i = 0; i < pageCount; i++) {
			const tokens: string[] = ['a', 'b'];
			if (i < 65) tokens.push('c');
			if (i < 3) tokens.push('d');
			if (i < 2) tokens.push('e');
			perPage.push([instance(tokens)]);
		}
		expect(shellQuorum(perPage)).toStrictEqual(new Set(['a', 'b', 'c']));
	});

	test('a token shared by two landmark instances on the same page counts once for that page', () => {
		// page 0 carries 'x' in both header and footer; page 1 has no
		// landmarks. Without per-page dedupe, page 0 would contribute count=2
		// for 'x', pushing freq to 1.0 (shell). With correct dedupe, freq is
		// 1/2 = 0.5, below the single-token fallback clamp (0.8) → not shell.
		const perPage = [[instance(['x'], 'header'), instance(['x'], 'footer')], []];
		expect(shellQuorum(perPage)).toStrictEqual(new Set());
	});

	test('a page with no landmark instances still counts toward the pageCount denominator', () => {
		// freq('x') = 1/2 = 0.5 (single distinct token, clamp 0.8) → not
		// shell. Proves the landmark-less page isn't skipped from the count.
		const perPage = [[instance(['x'])], []];
		expect(shellQuorum(perPage)).toStrictEqual(new Set());
	});
});
