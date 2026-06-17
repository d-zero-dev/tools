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

## DOM 文字列からメタ抽出（Puppeteer なし）

HTML 文字列を jsdom などでパースしてから `Meta` を取り出したい場合、`extractMetaFromDocument` を使う。`Scraper` が内部で呼ぶ `collectHead → detectTags → classify` パイプラインと同じ実装を再利用するため、戻り値の `Meta` 形状は `scrapeStart` と同一。DOM ライブラリ（jsdom 等）はユーザランドの責務。

```ts
import { extractMetaFromDocument } from '@d-zero/beholder';
import { JSDOM } from 'jsdom';

const url = 'https://example.com/';
const html = await (await fetch(url)).text();
const dom = new JSDOM(html, { url });

// `as unknown as Window` は jsdom の `DOMWindow` 型が lib.dom の `Window` と
// 構造的に完全一致しないための型キャスト。ランタイムでは互換。
const meta = await extractMetaFromDocument(dom.window as unknown as Window, {
	url,
	html,
});

console.log(meta.title);
console.log(meta.og?.image);
console.log(meta.tags.entries);
```

`context.html` を省略すると `window.document.documentElement.outerHTML` がフォールバックされる。ただし Wappalyzer の HTML パターンはスクリプト実行前の生 HTML に合わせて作られているので、可能なら取得直後の HTML 文字列を明示的に渡す方が検出が安定する。
