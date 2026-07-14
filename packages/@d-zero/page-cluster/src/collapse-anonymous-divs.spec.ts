import { describe, expect, test } from 'vitest';

import { collapseAnonymousDivs } from './collapse-anonymous-divs.js';

describe('collapseAnonymousDivs', () => {
	test('token with 2 segments is returned as-is', () => {
		expect(collapseAnonymousDivs('body>div')).toBe('body>div');
	});

	test('bare div in middle is removed', () => {
		expect(collapseAnonymousDivs('body>div>section')).toBe('body>section');
	});

	test('bare span in middle is removed', () => {
		expect(collapseAnonymousDivs('body>span>section')).toBe('body>section');
	});

	test('div with class in middle is preserved', () => {
		// 'div.class' is not in FOLDABLE_TAGS as a whole string
		expect(collapseAnonymousDivs('body>div.class>section')).toBe(
			'body>div.class>section',
		);
	});

	test('div with bracket in middle is preserved', () => {
		// 'div[role=main]' is not in FOLDABLE_TAGS as a whole string
		expect(collapseAnonymousDivs('body>div[role=main]>section')).toBe(
			'body>div[role=main]>section',
		);
	});

	test('bare div/span at first and last positions are always preserved', () => {
		// only the middle segment 'main' is checked; first 'div' and last 'span' are untouched
		expect(collapseAnonymousDivs('div>main>span')).toBe('div>main>span');
	});

	test('non-foldable tag in middle is preserved', () => {
		// 'main' and 'section' are not in FOLDABLE_TAGS
		expect(collapseAnonymousDivs('body>main>section')).toBe('body>main>section');
	});

	test('multiple bare divs in middle are all removed', () => {
		expect(collapseAnonymousDivs('body>div>div>section')).toBe('body>section');
	});
});
