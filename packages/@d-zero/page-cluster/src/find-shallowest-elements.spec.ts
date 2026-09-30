import { describe, expect, test } from 'vitest';

import {
	findMatchingElements,
	findShallowestElements,
} from './find-shallowest-elements.js';

const asBanner = (tagName: string, role: string | undefined): readonly 'landmark'[] =>
	tagName === 'header' || role === 'banner' ? (['landmark'] as const) : ([] as const);

describe('findMatchingElements', () => {
	test('returns every genuinely-closed match in document order of the opening tag', () => {
		const html = '<body><header>A</header><main><header>Nested</header></main></body>';
		const matches = findMatchingElements(html, asBanner);
		expect(matches.map((m) => html.slice(m.startOffset, m.endOffset))).toStrictEqual([
			'<header>A</header>',
			'<header>Nested</header>',
		]);
	});

	test('depth reports ancestors since <body>', () => {
		const html = '<body><header>A</header><main><header>Nested</header></main></body>';
		const matches = findMatchingElements(html, asBanner);
		expect(matches.map((m) => m.depth)).toStrictEqual([1, 2]);
	});

	test('skips matches nested inside opaque tags', () => {
		const html = '<body><svg><header>fake</header></svg><header>real</header></body>';
		const matches = findMatchingElements(html, asBanner);
		expect(matches).toHaveLength(1);
		expect(html.slice(matches[0]!.startOffset, matches[0]!.endOffset)).toBe(
			'<header>real</header>',
		);
	});

	test('discards a candidate whose closing tag is not genuine', () => {
		// Unclosed <header> — htmlparser2 will emit a synthesized close at
		// </body>'s position; isGenuineClose flags it and findMatchingElements
		// must drop it, not corrupt callers with a span slicing into unrelated
		// content.
		const html = '<body><header>H<main><article>Real</article></main></body>';
		const matches = findMatchingElements(html, asBanner);
		expect(matches).toStrictEqual([]);
	});

	test('a role match and a tag match on the same element are both reported', () => {
		const asHeaderOrNav = (
			tagName: string,
			role: string | undefined,
		): readonly ('header' | 'nav')[] => {
			const types: ('header' | 'nav')[] = [];
			if (tagName === 'header') types.push('header');
			if (role === 'navigation') types.push('nav');
			return types;
		};
		const html = '<body><header role="navigation">HN</header></body>';
		const matches = findMatchingElements(html, asHeaderOrNav);
		expect(matches.map((m) => m.type).toSorted()).toStrictEqual(['header', 'nav']);
		// Both matches point at the exact same element.
		expect(matches[0]!.startOffset).toBe(matches[1]!.startOffset);
		expect(matches[0]!.endOffset).toBe(matches[1]!.endOffset);
	});
});

describe('findShallowestElements', () => {
	test('picks the shallowest match per type', () => {
		const html = '<body><header>A</header><main><header>Nested</header></main></body>';
		const matches = findShallowestElements(html, asBanner);
		expect(matches).toHaveLength(1);
		expect(html.slice(matches[0]!.startOffset, matches[0]!.endOffset)).toBe(
			'<header>A</header>',
		);
	});

	test('at equal depth, the first match in document order wins', () => {
		const html = '<body><header>First</header><header>Second</header></body>';
		const matches = findShallowestElements(html, asBanner);
		expect(html.slice(matches[0]!.startOffset, matches[0]!.endOffset)).toBe(
			'<header>First</header>',
		);
	});

	test('a page with no matches returns an empty array', () => {
		const html = '<body><main>only content</main></body>';
		expect(findShallowestElements(html, asBanner)).toStrictEqual([]);
	});

	test('depth is not present on the returned shape (internal selection artifact only)', () => {
		const html = '<body><header>A</header></body>';
		const matches = findShallowestElements(html, asBanner);
		// Runtime check: the object has no `depth` field.
		expect(Object.keys(matches[0]!)).not.toContain('depth');
	});
});

describe('findShallowestElements (attribute-aware matcher)', () => {
	test('passes the element attribute map to the matcher as its third argument', () => {
		const html = '<body><div id="main" class="a b">x</div><div id="other">y</div></body>';
		const seen: Record<string, string>[] = [];
		findShallowestElements(html, (_tag, _role, attribs) => {
			seen.push({ ...attribs });
			return [] as const;
		});
		expect(seen).toStrictEqual([{}, { id: 'main', class: 'a b' }, { id: 'other' }]);
	});

	test('lets a matcher identify elements by id', () => {
		const html = '<body><div id="main">x</div></body>';
		const winners = findShallowestElements(html, (_tag, _role, attribs) =>
			attribs.id === 'main' ? (['main'] as const) : ([] as const),
		);
		expect(winners.map((w) => html.slice(w.startOffset, w.endOffset))).toStrictEqual([
			'<div id="main">x</div>',
		]);
	});
});
