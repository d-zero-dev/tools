# `@d-zero/puppeteer-page-scan`

PuppeteerでスクリーンショットやDOMスキャンする際に必要なヘルパー関数とデバイス設定を提供します。

## インストール

```sh
yarn install @d-zero/puppeteer-page-scan
```

## 使い方

### デバイスプリセット

複数のデバイスサイズ用のプリセットが利用可能です：

```ts
import {
	devicePresets,
	createSizesFromDevices,
	parseDevicesOption,
} from '@d-zero/puppeteer-page-scan';

// 利用可能なデバイスプリセット
console.log(devicePresets);
// {
//   desktop: { width: 1400 },
//   tablet: { width: 768 },
//   mobile: { width: 375, resolution: 2 },
//   'desktop-hd': { width: 1920 },
//   'desktop-compact': { width: 1280 },
//   'mobile-large': { width: 414, resolution: 3 },
//   'mobile-small': { width: 320, resolution: 2 }
// }

// プリセット名からSizesオブジェクトを生成
const sizes = createSizesFromDevices(['desktop', 'mobile']);

// CLI用のパーサー（コンマ区切りの文字列から）
const parsedSizes = parseDevicesOption(['desktop', 'tablet']);
```

### `beforePageScan`

- ビューポートの設定
- ページのリロード
- 任意のフック処理
  - ログインなどの事前処理
- disclosure要素の展開（オプション）
  - すべての`<details>`要素を開き、すべての`button[aria-expanded="false"]`要素をクリック
  - 新しい要素が見つからなくなるまで繰り返し処理（最大1000回）
  - 各イテレーション後に500ms待機
  - 最大イテレーション数に達した場合はErrorを投げる
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
	openDisclosures: true, // オプション: disclosure要素を展開（<details>とbutton[aria-expanded="false"]）
});
```
