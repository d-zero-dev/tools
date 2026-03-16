# `@d-zero/beholder`

Puppeteer を使用してWebページをスクレイピングし、メタデータ・リンク・画像・ネットワークリソースを収集するライブラリです。

**名前の由来**: **[Beholder](https://forgottenrealms.fandom.com/wiki/Beholder)** という名前は、多くの目を持つ神話上の生物に由来しています。この生物のように、このツールはWebページを正確かつ徹底的にスクレイピングして記録し、詳細を見逃しません。

## インストール

```bash
yarn add @d-zero/beholder
```

## 概要

`@d-zero/beholder` は、Puppeteer の `Page` オブジェクトを受け取り、単一ページのスクレイピングを行うインプロセス型のスクレイパーです。

**主な特徴:**

- 結果は `ScrapeResult` として戻り値で返却（イベント経由ではない）
- ストリーミングイベント（`changePhase`, `resourceResponse`）で進捗を監視可能
- キーワード・パス除外によるページスキップ
- 複数デバイスプリセット対応のレスポンシブ画像キャプチャ
- ブラウザ管理は呼び出し側の責任（Scraperはページ操作のみ）

## エクスポートされるAPI

### `Scraper`（デフォルトエクスポート）

ページレベルのスクレイパークラスです。`TypedAwaitEventEmitter` を継承しています。

```typescript
import Scraper from '@d-zero/beholder';
```

#### `scrapeStart(page, url, options?, isSkip?)`

Puppeteer ページ上でスクレイピングを実行します。

**パラメータ:**

- `page` (`Page`) — Puppeteer ページインスタンス
- `url` (`ExURL`) — スクレイピング対象のURL
- `options` (`Partial<ScraperOptions>`, 省略可) — スクレイピングオプション
- `isSkip` (`boolean`, 省略可) — `true` でネットワークリクエストなしにスキップ

**戻り値:** `Promise<ScrapeResult>`

- `type: "success"` — `pageData` にスクレイピング結果を格納
- `type: "skipped"` — `ignored` にスキップ理由を格納
- `type: "error"` — `error` にエラー詳細を格納
- `failedRequests` — ネットワーク切断等で失敗したサブリソースリクエストの一覧（存在する場合のみ）

**使用例:**

```typescript
import Scraper from '@d-zero/beholder';
import { parseUrl } from '@d-zero/shared/parse-url';
import { launch } from 'puppeteer';

const browser = await launch();
const page = await browser.newPage();

const scraper = new Scraper();

// 進捗イベントを監視
scraper.on('changePhase', async (event) => {
	console.log(`[${event.pid}] ${event.name}: ${event.message}`);
});

// スクレイピングを実行
const url = parseUrl('https://example.com');
const result = await scraper.scrapeStart(page, url, {
	captureImages: true,
	excludeKeywords: ['広告'],
	isExternal: false,
});

if (result.type === 'success') {
	console.log('タイトル:', result.pageData?.meta.title);
	console.log('リンク数:', result.pageData?.anchorList.length);
	console.log('画像数:', result.pageData?.imageList.length);
	console.log('サブリソース数:', result.resources.length);
}

// クリーンアップはブラウザレベルで行う
await page.close();
await browser.close();
```

#### イベント

| イベント名         | 説明                                           |
| ------------------ | ---------------------------------------------- |
| `changePhase`      | スクレイピングフェーズが遷移した場合           |
| `resourceResponse` | サブリソースのレスポンスがキャプチャされた場合 |

### `ScraperOptions`

| プロパティ          | 型         | デフォルト | 説明                                                             |
| ------------------- | ---------- | ---------- | ---------------------------------------------------------------- |
| `isExternal`        | `boolean`  | `false`    | 外部URLかどうか                                                  |
| `captureImages`     | `boolean`  | `true`     | 画像データを取得するかどうか                                     |
| `excludeKeywords`   | `string[]` | `[]`       | HTML内にマッチしたらスキップするキーワード                       |
| `metadataOnly`      | `boolean`  | `false`    | メタデータのみ取得（ブラウザスクレイピングなし）                 |
| `imageLoadTimeout`  | `number`   | `5000`     | 画像読み込み待機のタイムアウト（ms）                             |
| `disableQueries`    | `boolean`  | -          | URLパース時にクエリパラメータを除去するかどうか                  |
| `retries`           | `number`   | -          | ネットワーク操作のリトライ回数                                   |
| `headCheckResult`   | `PageData` | -          | 事前取得したHEADチェック結果（省略時はHEADリクエストをスキップ） |
| `navigationTimeout` | `number`   | `60000`    | `page.goto()` のタイムアウト（ms）                               |

### ユーティリティ関数

#### `isError(status)`

HTTPステータスコードがエラーかどうかを判定します。200-399 は成功、それ以外はエラーです。

```typescript
import { isError } from '@d-zero/beholder';

isError(200); // false
isError(404); // true
```

#### `detectCompress(headers)` / `detectCDN(headers)`

レスポンスヘッダーから圧縮方式・CDNプロバイダを検出します（`@d-zero/shared` からの再エクスポート）。

### 型定義

#### `ScrapeResult`

スクレイピング操作の結果を表します。

```typescript
type ScrapeResult = {
	type: 'success' | 'skipped' | 'error';
	pageData?: PageData;
	resources: ResourceEntry[];
	ignored?: { url: ExURL; matchedText: string; excludeKeywords: string[] };
	error?: { name: string; message: string; stack?: string; shutdown: boolean };
	failedRequests?: ReadonlyArray<{ url: string; errorText: string }>;
};
```

#### `PageData`

スクレイピング成功時のページデータです。

```typescript
type PageData = {
	url: ExURL;
	redirectPaths: string[];
	isTarget: boolean;
	isExternal: boolean;
	status: number;
	statusText: string;
	contentType: string | null;
	contentLength: number | null;
	responseHeaders: Record<string, string | string[] | undefined> | null;
	meta: Meta;
	anchorList: AnchorData[];
	imageList: ImageElement[];
	html: string;
	isSkipped: false;
};
```

#### `Meta`

ページの `<head>` から抽出されたメタデータです。

```typescript
type Meta = {
	lang?: string;
	title: string;
	description?: string;
	keywords?: string;
	noindex?: boolean;
	nofollow?: boolean;
	noarchive?: boolean;
	canonical?: string;
	alternate?: string;
	'og:type'?: string;
	'og:title'?: string;
	'og:site_name'?: string;
	'og:description'?: string;
	'og:url'?: string;
	'og:image'?: string;
	'twitter:card'?: string;
};
```

#### `AnchorData`

アンカー要素（`<a>` / `<area>`）のデータです。

```typescript
type AnchorData = {
	href: ExURL;
	textContent: string;
	isExternal?: boolean;
};
```

#### `ImageElement`

画像要素のデータです。デバイスプリセットごとにキャプチャされます。

```typescript
type ImageElement = {
	src: string;
	currentSrc: string;
	alt: string;
	width: number;
	height: number;
	naturalWidth: number;
	naturalHeight: number;
	isLazy: boolean;
	viewportWidth: number;
	sourceCode: string;
};
```

#### `ResourceEntry`

ページ読み込み中にキャプチャされたサブリソースです。

```typescript
type ResourceEntry = {
	log: NetworkLog;
	resource: Omit<Resource, 'uid'>;
	pageUrl: string;
};
```

#### `NetworkLog`

ネットワークリクエスト/レスポンスのログエントリです。

```typescript
type NetworkLog = {
	url: ExURL;
	status: number | null;
	contentLength: number;
	contentType: string;
	isError: boolean;
	request: { ts: number; headers: Record<string, string>; method: string };
	response?: {
		ts: number;
		status: number;
		statusText: string;
		fromCache: boolean;
		headers: Record<string, string>;
	};
};
```

#### `Resource`

ネットワークリソースのメタデータです。

```typescript
type Resource = {
	url: ExURL;
	isExternal: boolean;
	isError: boolean;
	status: number | null;
	statusText: string | null;
	contentType: string | null;
	contentLength: number | null;
	compress: false | CompressType;
	cdn: false | CDNType;
	headers: Record<string, string | string[] | undefined> | null;
};
```

#### `ChangePhaseEvent`

スクレイピングライフサイクルのフェーズ遷移イベントです。

主なフェーズ: `scrapeStart` → `openPage` → `loadDOMContent` → `waitNetworkIdle` → `getHTML` → `getAnchors` → `getMeta` → `extractImages` → `getImages` → `scrapeEnd`

その他のフェーズ: `launchBrowser`, `headRequest`, `headRequestTimeout`, `newPage`, `setViewport`, `scrollToBottom`, `waitImageLoad`, `pageSkipped`, `retryWait`, `retryExhausted`, `beforeCleanup`, `cleanedUp`

#### `SkippedPageData`

キーワードまたはパス除外によりスキップされたページのデータです。

```typescript
type SkippedPageData = {
	isSkipped: true;
	url: ExURL;
	matched:
		| { type: 'keyword'; text: string; excludeKeywords: string[] }
		| { type: 'path'; excludes: string[] };
};
```

## ライセンス

MIT
