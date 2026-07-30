import type { Page } from 'puppeteer';

import {
	MAIN_CONTENT_FALLBACK_SELECTORS,
	MAIN_CONTENT_SELECTORS,
} from '@d-zero/beholder';
import { describe, expect, it, vi } from 'vitest';

import { captureLayoutTree } from './capture-layout-tree.js';
import { captureLayout } from './capture-layout.js';

describe('captureLayout', () => {
	it('evaluates captureLayoutTree with the shared beholder selector lists and defaults', async () => {
		const evaluate = vi.fn().mockResolvedValue({ mainSelector: null, root: null });
		const page = { evaluate } as unknown as Page;

		await captureLayout(page);

		expect(evaluate).toHaveBeenCalledWith(
			captureLayoutTree,
			null,
			MAIN_CONTENT_SELECTORS,
			MAIN_CONTENT_FALLBACK_SELECTORS,
			60,
		);
	});

	it('forwards an explicit mainContentSelector and captureMaxDepth', async () => {
		const evaluate = vi.fn().mockResolvedValue({ mainSelector: '#x', root: null });
		const page = { evaluate } as unknown as Page;

		await captureLayout(page, { mainContentSelector: '#x', captureMaxDepth: 5 });

		expect(evaluate).toHaveBeenCalledWith(
			captureLayoutTree,
			'#x',
			MAIN_CONTENT_SELECTORS,
			MAIN_CONTENT_FALLBACK_SELECTORS,
			5,
		);
	});
});
