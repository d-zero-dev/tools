import { describe, expect, it } from 'vitest';

import { extractMainContentsFromDocument } from './get-main-contents.js';
import {
	MAIN_CONTENT_FALLBACK_SELECTORS,
	MAIN_CONTENT_SELECTORS,
} from './main-content-selectors.js';

/**
 * Extracts every quoted string literal from a slice of source text (either
 * quote style, tolerating `\"`/`\'` escapes) in order of appearance.
 *
 * WHY this instead of a membership-only check: asserting only that every
 * shared-constant selector *appears somewhere* in the inlined function
 * catches a selector being dropped from the constants, but not the
 * reverse — an inlined selector added or edited without updating
 * `main-content-selectors.ts` would still pass. Extracting the exact
 * inlined array's contents and comparing it (in order) against the
 * exported constant catches drift in both directions.
 * @param source
 */
function extractStringLiterals(source: string): string[] {
	return [...source.matchAll(/(["'])((?:\\.|(?!\1).)*)\1/g)].map((m) =>
		m[2]!.replaceAll(String.raw`\"`, '"').replaceAll(String.raw`\'`, "'"),
	);
}

/**
 * @param source
 * @param variableName
 */
function extractInlineArray(source: string, variableName: string): string[] {
	const match = new RegExp(`const ${variableName} = (\\[[\\s\\S]*?\\]);`).exec(source);
	if (!match) {
		throw new Error(
			`could not find "const ${variableName} = [...]" in the function source`,
		);
	}
	return extractStringLiterals(match[1]!);
}

describe('main-content-selectors', () => {
	it('matches, in order, the selectors array inlined in extractMainContentsFromDocument', () => {
		const source = extractMainContentsFromDocument.toString();
		expect(extractInlineArray(source, 'selectors')).toEqual(MAIN_CONTENT_SELECTORS);
	});

	it('matches, in order, the fallbackSelectors array inlined in extractMainContentsFromDocument', () => {
		const source = extractMainContentsFromDocument.toString();
		expect(extractInlineArray(source, 'fallbackSelectors')).toEqual(
			MAIN_CONTENT_FALLBACK_SELECTORS,
		);
	});
});
