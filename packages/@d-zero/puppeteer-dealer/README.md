# `@d-zero/puppeteer-dealer`

```ts
import { deal } from '@d-zero/puppeteer-dealer';

await deal(
	// Input list data
	[
		{
			id: '1',
			url: 'https://example.com',
		},
		{
			id: '2',
			url: 'https://example.com',
		},
	],

	// Header log
	(progress, done, total) => {
		return `Header ${Math.ceil(progress * 100)}% ${done}/${total}`;
	},

	// Handlers
	{
		async beforeOpenPage(id, url, logger) {
			if (condition) {
				// continue (like Event preventDefault)
				return false;
			}

			return true;
		},
		async deal(page, id, url, logger) {
			// Do something
			await page.goto(url);
			await page.waitForSelector('body');
		},
	},

	// Options
	{
		locale: 'ja-JP',
		debug: false,
		limit: 10,
		verbose: false,

		// Puppeteer launch options
		headless: true,
	},
);
```
