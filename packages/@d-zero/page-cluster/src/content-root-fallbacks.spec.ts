import { describe, expect, test } from 'vitest';

import { FALLBACK_CONTENT_ROOTS } from './content-root-fallbacks.js';

describe('FALLBACK_CONTENT_ROOTS', () => {
	test('lists the crawler main-content selectors after <main>/role=main, in priority order, id before class', () => {
		expect(FALLBACK_CONTENT_ROOTS).toStrictEqual([
			{ id: 'main' },
			{ classList: ['main'] },
			{ id: 'content' },
			{ classList: ['content'] },
			{ id: 'contents' },
			{ classList: ['contents'] },
			{ id: 'main-content' },
			{ classList: ['main-content'] },
			{ id: 'main_content' },
			{ classList: ['main_content'] },
			{ id: 'mainContent' },
			{ classList: ['mainContent'] },
		]);
	});
});
