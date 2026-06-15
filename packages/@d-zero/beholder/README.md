# `@d-zero/beholder`

Puppeteer の `Page` を受け取り、単一ページのメタデータ・リンク・画像・ネットワークリソースを収集するインプロセス型スクレイパー。結果は `ScrapeResult` として戻り値で返却される（イベント経由ではない）。ブラウザ管理は呼び出し側の責任。

## Installation

```sh
yarn add @d-zero/beholder
```

## Usage

```ts
import Scraper from '@d-zero/beholder';
import { parseUrl } from '@d-zero/shared/parse-url';
import { launch } from 'puppeteer';

const browser = await launch();
const page = await browser.newPage();

const scraper = new Scraper();
scraper.on('changePhase', (event) => console.log(event.message));

const result = await scraper.scrapeStart(page, parseUrl('https://example.com'), {
	captureImages: true,
	isExternal: false,
});

if (result.type === 'success') {
	console.log(result.pageData?.meta.title);
}
```

設計判断（イベントではなく戻り値で返す理由、`page` のライフサイクル責務、リトライ機構など）は `src/scraper.ts` の JSDoc を参照。
