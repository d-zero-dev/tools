import { describe, expect, it } from 'vitest';

import { DEFAULT_VIEWPORTS } from './default-viewports.js';

describe('DEFAULT_VIEWPORTS', () => {
	it('lists pc, tablet, then sp, largest width first', () => {
		expect(DEFAULT_VIEWPORTS).toEqual([
			{ name: 'pc', width: 1280 },
			{ name: 'tablet', width: 768 },
			{ name: 'sp', width: 375 },
		]);
	});

	it('is ordered strictly by decreasing width', () => {
		const widths = DEFAULT_VIEWPORTS.map((v) => v.width);
		expect(widths).toEqual(widths.toSorted((a, b) => b - a));
	});
});
