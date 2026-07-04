import { describe, expect, test } from 'vitest';

import { resolveLandmarkVariantKeys } from './resolve-landmark-variant-keys.js';

describe('resolveLandmarkVariantKeys', () => {
	test('an empty array returns an empty array', () => {
		expect(resolveLandmarkVariantKeys([], 'header')).toEqual([]);
	});

	test('matches the exact output documented in the JSDoc @example', () => {
		// Kept in sync with resolveLandmarkVariantKeys's @example: if this
		// ever fails, the JSDoc example is out of date and must be corrected
		// alongside the implementation, not the other way around.
		const result = resolveLandmarkVariantKeys(
			[
				'<body><header><nav>A</nav></header></body>',
				'<body><header><nav>A</nav></header></body>',
				'<body><header><a>B</a></header></body>',
			],
			'header',
		);
		expect(result[0]).toBe(result[1]);
		expect(result[2]).not.toBe(result[0]);
	});

	test('pages with no matching landmark all land in the same "has none" group', () => {
		const result = resolveLandmarkVariantKeys(
			['<body><main>a</main></body>', '<body><main>b</main></body>'],
			'header',
		);
		expect(result[0]).toBe(result[1]);
	});

	test('a page with no matching landmark is never grouped with a page that has one', () => {
		const result = resolveLandmarkVariantKeys(
			[
				'<body><main>no header here</main></body>',
				'<body><header><nav>x</nav></header></body>',
			],
			'header',
		);
		expect(result[0]).not.toBe(result[1]);
	});

	test('an empty-but-present landmark (e.g. <header></header>) does not collide with the "absent" sentinel', () => {
		const result = resolveLandmarkVariantKeys(
			['<body><main>no header here</main></body>', '<body><header></header></body>'],
			'header',
		);
		expect(result[0]).not.toBe(result[1]);
	});

	test('landmarkType selects an independent classification even for the same htmlList', () => {
		// header⊃nav nesting: classifying by 'header' and by 'nav' on the same
		// pages must both work correctly off the same underlying extraction,
		// even when the nav is identical but the surrounding header is not.
		const htmlList = [
			'<body><header><nav>same-nav</nav><a>extra-a</a></header></body>',
			'<body><header><nav>same-nav</nav><p>extra-b</p></header></body>',
		];
		const byHeader = resolveLandmarkVariantKeys(htmlList, 'header');
		const byNav = resolveLandmarkVariantKeys(htmlList, 'nav');

		expect(byNav[0]).toBe(byNav[1]);
		expect(byHeader[0]).not.toBe(byHeader[1]);
	});

	test('two structurally different nav elements are classified into different variants', () => {
		// Jaccard compares token *sets*, so a difference in repeat count alone
		// (e.g. two <a> vs one <a>) collapses to the same set and would not
		// distinguish these — the difference here is a distinct element type
		// (<a> vs <button>) so the token sets are genuinely different.
		const result = resolveLandmarkVariantKeys(
			[
				'<body><nav><a>1</a><a>2</a></nav></body>',
				'<body><nav><a>1</a><a>2</a></nav></body>',
				'<body><nav><a>1</a><button>2</button></nav></body>',
			],
			'nav',
		);
		expect(result[0]).toBe(result[1]);
		expect(result[2]).not.toBe(result[0]);
	});
});
