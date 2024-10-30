# `@d-zero/puppeteer-page`

This module optimizes parallel processing by running Puppeteer as a child process, ensuring each browser instance operates in isolation. This design supports high-performance, concurrent sessions without risking resource contention in the main process, making it ideal for applications requiring robust parallelized browser automation.

```ts
import { createPage } from '@d-zero/puppeteer-page';

const page = await createPage({
	// Puppeteer launch options
	headless: true,

	// specific page options
	runChildProcess: true,
});

await page.goto('https://example.com');
```
