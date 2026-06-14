# `@d-zero/puppeteer-screenshot`

Puppeteer で複数サイズのスクリーンショット + DOM テキスト + alt 属性を取得するユーティリティ。

## Installation

```sh
yarn add @d-zero/puppeteer-screenshot
```

## Usage

```ts
import { screenshot, screenshotListener } from '@d-zero/puppeteer-screenshot';

const result = await screenshot(page, 'https://example.com', {
	path: 'path/to/save.png',
	sizes: {
		desktop: { width: 1400 },
		mobile: { width: 375, resolution: 2 },
	},
	listener: screenshotListener,
});
```

`path` を指定すると `save@desktop.png`、`save@mobile.png` のようにサイズ別に保存される。オプション詳細は型定義を参照。

スクロール挙動（`scrollInterval` / `scrollDistance`）の決定論的指定が必要なら [`@d-zero/puppeteer-scroll`](../puppeteer-scroll/) を参照。
