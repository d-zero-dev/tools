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

// スクリーンショットのバイナリデータを持つオブジェクトを返します
const result = await screenshot(page, 'https://example.com', {
	path: 'path/to/save.png', // 保存先のパスを指定することでファイルに保存できます（省略可）
	sizes: {
		desktop: { width: 1400 },
		mobile: { width: 375, resolution: 2 },
	},
	listener: (phase, data) => {
		console.log(phase, data);
	},
});
```
