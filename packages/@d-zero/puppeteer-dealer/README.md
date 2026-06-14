# `@d-zero/puppeteer-dealer`

Puppeteer を使ってマルチプロセスで複数 URL を処理するためのユーティリティ。

## Installation

```sh
yarn add @d-zero/puppeteer-dealer
```

## Usage

親プロセス:

```ts
import { deal, createProcess } from '@d-zero/puppeteer-dealer';

await deal(
	[{ id: '1', url: 'https://example.com' }],
	(progress, done, total) => `${done}/${total}`,
	() =>
		createProcess(
			'./child.js',
			{
				/* params */
			},
			{ locale: 'ja-JP', headless: true },
		),
	{ limit: 5 },
);
```

子プロセス（`./child.js`）:

```ts
import { createChildProcess } from '@d-zero/puppeteer-dealer';

createChildProcess<{ outputDir: string }>((params) => ({
	async eachPage({ page, id, url }, logger) {
		await page.goto(url);
		await page.screenshot({ path: `${params.outputDir}/${id}.png` });
	},
}));
```
