# `@d-zero/puppeteer-page-scan`

PuppeteerでスクリーンショットやDOMスキャンする際に必要なヘルパー関数を提供します。

## インストール

```sh
yarn install @d-zero/puppeteer-page-scan
```

## 使い方

### `beforePageScan`

- ビューポートの設定
- ページのリロード
- 任意のフック処理
  - ログインなどの事前処理
- ページ全体をスクロール

などを行い、スキャンに必要な状態を整えるためのヘルパー関数です。

```ts
import { beforePageScan } from '@d-zero/puppeteer-page-scan';

const browser = await puppeteer.launch();
const page = await browser.newPage();

await beforePageScan(page, 'https://example.com', {
	name: 'desktop',
	width: 1200,
	resolution: 1,
	listeners: {
		setViewport() {},
		hook() {},
		load() {},
		scroll() {},
	},
	hooks: [
		async (page) => {
			await page.type('#username', 'user');
			await page.type('#password', 'password');
			await page.click('button[type="submit"]');
		},
	],
});
```
