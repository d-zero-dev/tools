import { describe, test, expect } from 'vitest';

import { createPage } from '../dist/index.js';

describe('createPage', () => {
	test('returns a page', async () => {
		const page = await createPage({ headless: true });
		await page.goto('https://www.google.com');
		const title = await page.title();
		// await page.close();
		expect(title).toBe('Google');
	}, 30_000);
});
