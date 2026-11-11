import { describe, expect, test } from 'vitest';

import { quoteSheetTitle } from './quote-sheet-title.js';

describe('quoteSheetTitle', () => {
	test('wraps a title without quotes in single quotes', () => {
		expect(quoteSheetTitle('Report')).toBe("'Report'");
	});

	test('doubles each single quote inside the title', () => {
		expect(quoteSheetTitle("Year's End")).toBe("'Year''s End'");
	});

	test('doubles consecutive single quotes', () => {
		expect(quoteSheetTitle("a''b")).toBe("'a''''b'");
	});
});
