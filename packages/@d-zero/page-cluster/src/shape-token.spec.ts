import { describe, expect, test } from 'vitest';

import { shapeToken } from './shape-token.js';

describe('shapeToken', () => {
	test('foldable segment with classes maps to *', () => {
		expect(shapeToken('.class1.class2')).toBe('*');
	});

	test('non-foldable segment with classes keeps tag name only', () => {
		expect(shapeToken('section.c-reports')).toBe('section');
	});

	test('segment without classes is unchanged', () => {
		expect(shapeToken('main')).toBe('main');
	});

	test('bracket suffix is preserved after class removal', () => {
		expect(shapeToken('section.c-works[sha=abc]')).toBe('section[sha=abc]');
	});

	test('foldable segment with classes and bracket maps to * with bracket', () => {
		expect(shapeToken('.nav[role=banner]')).toBe('*[role=banner]');
	});

	test('segment with bracket but no class dot is unchanged', () => {
		// base = 'div', indexOf('.') === -1 → no class stripping, bracket preserved
		expect(shapeToken('div[role=dialog]')).toBe('div[role=dialog]');
	});

	test('full path: class names stripped from each segment', () => {
		expect(shapeToken('body>main>section.c-works>ul.c-list')).toBe(
			'body>main>section>ul',
		);
	});
});
