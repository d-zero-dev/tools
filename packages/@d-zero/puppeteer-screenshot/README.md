# `@d-zero/puppeteer-screenshot`

Puppeteerでスクリーンショットを撮るためのユーティリティです。

## インストール

```sh
yarn install @d-zero/puppeteer-screenshot
```

## 使い方

```ts
import { screenshot } from '@d-zero/puppeteer-screenshot';

const browser = await puppeteer.launch();
const page = await browser.newPage();

const result = await screenshot(page, 'https://example.com', {
	sizes: {
		desktop: { width: 1400 },
		mobile: { width: 375, resolution: 2 },
	},
	listener: (phase, data) => {
		console.log(phase, data);
	},
});
```
