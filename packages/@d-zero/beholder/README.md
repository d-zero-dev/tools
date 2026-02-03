# `@d-zero/beholder`

Webページのスクレイピングと記録を行うツールです。

**名前の由来**: **[Beholder](https://forgottenrealms.fandom.com/wiki/Beholder)** という名前は、多くの目を持つ神話上の生物に由来しています。この生物のように、このツールは周囲のすべてを観察する能力を象徴しており、Webページを正確かつ徹底的にスクレイピングして記録し、詳細を見逃しません。

## インストール

```bash
npm install @d-zero/beholder
```

または

```bash
yarn add @d-zero/beholder
```

## 概要

`@d-zero/beholder` は、Puppeteerを使用してWebページをスクレイピングし、ページのメタデータ、画像、リンク、およびHTML内容を収集するための強力なツールです。サブプロセスでスクレイピングを実行することで、メモリ効率的な運用が可能です。

## エクスポートされるAPI

### クラス

#### `Scraper` (デフォルトエクスポート)

メインのスクレイパークラスです。Puppeteerを使用してWebページをスクレイピングし、イベントを通じて進捗状況を通知します。

```typescript
import Scraper from '@d-zero/beholder';
```

##### メソッド

###### `scrapeStart(url: ExURL, options?: Partial<ScraperOptions>, isSkip?: boolean): Promise<PageData | void>`

指定されたURLのスクレイピングを開始します。

**パラメータ:**

- `url` (`ExURL`): スクレイピング対象のURL
- `options` (`Partial<ScraperOptions>`, オプション): スクレイピングオプション
  - `isExternal` (`boolean`): 外部URLかどうか (デフォルト: `false`)
  - `isGettingImages` (`boolean`): 画像情報を取得するかどうか (デフォルト: `true`)
  - `excludeKeywords` (`string[]`): 除外するキーワードのリスト (デフォルト: `[]`)
  - `executablePath` (`string | null`): Chromeの実行可能ファイルパス (デフォルト: `null`)
  - `isTitleOnly` (`boolean`): タイトルのみを取得するかどうか (デフォルト: `false`)
  - `screenshot` (`string | null`): スクリーンショットの保存パス (デフォルト: `null`)
  - `disableQueries` (`boolean`, オプション): クエリパラメータを無効にするかどうか
- `isSkip` (`boolean`, オプション): スキップするかどうか (デフォルト: `false`)

**戻り値:**

- `Promise<PageData | void>`: スクレイピング結果のページデータ、またはスキップされた場合は `void`

**使用例:**

```typescript
const scraper = new Scraper();

// イベントリスナーを登録
scraper.on('scrapeEnd', async (event) => {
	console.log('スクレイピング完了:', event.result);
});

scraper.on('error', async (event) => {
	console.error('エラー発生:', event.error);
});

// スクレイピングを開始
const url = parseUrl('https://example.com');
await scraper.scrapeStart(url, {
	isGettingImages: true,
	excludeKeywords: ['広告', 'スポンサー'],
});

// 完了後にクリーンアップ
await scraper.destroy(false);
```

###### `destroy(isExternal: boolean): Promise<void>`

スクレイパーインスタンスを破棄し、ブラウザを閉じます。

**パラメータ:**

- `isExternal` (`boolean`): 外部URLのスクレイピングかどうか

**戻り値:**

- `Promise<void>`

**使用例:**

```typescript
await scraper.destroy(false);
```

##### イベント

`Scraper` クラスは `TypedAwaitEventEmitter` を継承しており、以下のイベントを発行します:

- `ignoreAndSkip`: ページがキーワードマッチングによりスキップされた場合
- `resourceResponse`: リソースが取得された場合
- `scrapeEnd`: スクレイピングが完了した場合
- `destroyed`: スクレイパーが破棄された場合
- `error`: エラーが発生した場合
- `changePhase`: スクレイピングフェーズが変更された場合

**イベントの使用例:**

```typescript
scraper.on('changePhase', async (event) => {
	console.log(`フェーズ: ${event.name} - ${event.message}`);
});

scraper.on('resourceResponse', async (event) => {
	console.log(`リソース取得: ${event.resource.url.href}`);
});
```

#### `SubProcessRunner`

サブプロセスでスクレイパーを実行するためのクラスです。メモリ効率的なスクレイピングを実現します。

```typescript
import { SubProcessRunner } from '@d-zero/beholder';
```

##### コンストラクタ

```typescript
new SubProcessRunner(resetTime: number)
```

**パラメータ:**

- `resetTime` (`number`): サブプロセスをリセットするまでのスクレイピング回数

##### プロパティ

###### `state: 'waiting' | 'running'` (読み取り専用)

現在のサブプロセスの状態を取得します。

##### メソッド

###### `start(url: ExURL, options: ScraperOptions, isSkip: boolean, interval: number): void`

サブプロセスでスクレイピングを開始します。

**パラメータ:**

- `url` (`ExURL`): スクレイピング対象のURL
- `options` (`ScraperOptions`): スクレイピングオプション
- `isSkip` (`boolean`): スキップするかどうか
- `interval` (`number`): スクレイピング間隔(ミリ秒)

**例外:**

- サブプロセスが既に実行中の場合はエラーをスローします

**使用例:**

```typescript
const runner = new SubProcessRunner(10); // 10回ごとにリセット

runner.on('scrapeEvent', async (event) => {
	if (event.type === '@@scraper/scrapeEnd') {
		console.log('スクレイピング完了:', event.payload.result);
	}
});

runner.start(
	url,
	{
		isExternal: false,
		isGettingImages: true,
		excludeKeywords: [],
		executablePath: null,
		isTitleOnly: false,
		screenshot: null,
	},
	false,
	1000,
);
```

###### `destory(): void`

サブプロセスを破棄します。

**注意:** メソッド名は `destory` (typo) ですが、パッケージの互換性のため維持されています。

**使用例:**

```typescript
runner.destory();
```

###### `kill(): void`

サブプロセスを強制終了します(SIGKILL)。

**使用例:**

```typescript
runner.kill();
```

###### `getUndeadPid(): number[]`

終了できなかった(ゾンビ)プロセスのPIDリストを取得します。

**戻り値:**

- `number[]`: ゾンビプロセスのPIDリスト

**使用例:**

```typescript
const zombiePids = runner.getUndeadPid();
console.log('ゾンビプロセス:', zombiePids);
```

##### イベント

- `reset`: サブプロセスがリセットされた場合
- `scrapeEvent`: スクレイピングイベントが発生した場合
- `changePhase`: フェーズが変更された場合
- `error`: エラーが発生した場合

### 型定義

#### `ExURL`

拡張されたURL情報を含む型です。

```typescript
type ExURL = {
	href: string; // 完全なURL
	_originUrlString: string; // パース前の元のURL文字列
	withoutHash: string; // ハッシュなしのURL
	withoutHashAndAuth: string; // ハッシュと認証情報なしのURL
	protocol: string; // プロトコル(例: "https:")
	isHTTP: boolean; // HTTPまたはHTTPSかどうか
	isSecure: boolean; // HTTPSかどうか
	username: string | null; // 認証ユーザー名
	password: string | null; // 認証パスワード
	hostname: string; // ホスト名
	port: string | null; // ポート番号
	pathname: string | null; // パス
	paths: string[]; // パスの配列
	depth: number; // パスの深さ
	dirname: string | null; // ディレクトリ名
	basename: string | null; // ベース名(拡張子なしのファイル名)
	isIndex: boolean; // インデックスページかどうか
	extname: string | null; // ファイル拡張子
	query: string | null; // クエリ文字列
	hash: string | null; // ハッシュ
};
```

#### `PageData`

スクレイピング結果のページデータです。

```typescript
type PageData = {
	url: ExURL; // ページのURL
	redirectPaths: string[]; // リダイレクトパス
	isTarget: boolean; // ターゲットページかどうか
	isExternal: boolean; // 外部ページかどうか
	status: number; // HTTPステータスコード
	statusText: string; // HTTPステータステキスト
	contentType: string | null; // コンテンツタイプ
	contentLength: number | null; // コンテンツ長
	responseHeaders: Record<string, string | string[] | undefined> | null; // レスポンスヘッダー
	meta: Meta; // メタ情報
	anchorList: AnchorData[]; // アンカーリスト
	imageList: ImageElement[]; // 画像リスト
	html: string; // HTML内容
	isSkipped: false; // スキップされたかどうか
};
```

#### `Meta`

ページのメタデータです。

```typescript
type Meta = {
	lang?: string; // 言語
	title: string; // タイトル
	description?: string; // 説明
	keywords?: string; // キーワード
	noindex?: boolean; // noindexタグの有無
	nofollow?: boolean; // nofollowタグの有無
	noarchive?: boolean; // noarchiveタグの有無
	canonical?: string; // 正規URL
	alternate?: string; // 代替URL
	'og:type'?: string; // Open Graph: type
	'og:title'?: string; // Open Graph: title
	'og:site_name'?: string; // Open Graph: site_name
	'og:description'?: string; // Open Graph: description
	'og:url'?: string; // Open Graph: url
	'og:image'?: string; // Open Graph: image
	'twitter:card'?: string; // Twitter Card: card
};
```

#### `AnchorData`

アンカー要素のデータです。

```typescript
type AnchorData = {
	href: ExURL; // href属性の値
	textContent: string; // アクセシブルな名前
};
```

#### `ImageElement`

画像要素のデータです。

```typescript
type ImageElement = {
	src: string; // src属性
	currentSrc: string; // 現在のsrc
	alt: string; // alt属性
	width: number; // 表示幅
	height: number; // 表示高さ
	naturalWidth: number; // 実際の幅
	naturalHeight: number; // 実際の高さ
	isLazy: boolean; // 遅延読み込みかどうか
	viewportWidth: number; // ビューポート幅
	sourceCode: string; // ソースコード
};
```

#### `NetworkLog`

ネットワークログの情報です。

```typescript
type NetworkLog = {
	url: ExURL; // リクエストURL
	status: number | null; // ステータスコード
	contentLength: number; // コンテンツ長
	contentType: string; // コンテンツタイプ
	isError: boolean; // エラーかどうか
	request: {
		ts: number; // タイムスタンプ
		headers: Record<string, string>; // リクエストヘッダー
		method: string; // HTTPメソッド
	};
	response?: {
		ts: number; // タイムスタンプ
		status: number; // ステータスコード
		statusText: string; // ステータステキスト
		fromCache: boolean; // キャッシュから取得したかどうか
		headers: Record<string, string>; // レスポンスヘッダー
	};
};
```

#### `Resource`

リソースの情報です。

```typescript
type Resource = {
	url: ExURL; // リソースURL
	isExternal: boolean; // 外部リソースかどうか
	isError: boolean; // エラーかどうか
	status: number | null; // ステータスコード
	statusText: string | null; // ステータステキスト
	contentType: string | null; // コンテンツタイプ
	contentLength: number | null; // コンテンツ長
	compress: false | CompressType; // 圧縮タイプ
	cdn: false | CDNType; // CDNタイプ
	headers: Record<string, string | string[] | undefined> | null; // ヘッダー
};
```

#### `SkippedPageData`

スキップされたページのデータです。

```typescript
type SkippedPageData = {
	isSkipped: true; // スキップされたかどうか
	url: ExURL; // URL
	matched: {
		type: 'keyword' | 'path'; // マッチタイプ
		text?: string; // マッチしたテキスト(keywordの場合)
		excludeKeywords?: string[]; // 除外キーワード(keywordの場合)
		excludes?: string[]; // 除外パス(pathの場合)
	};
};
```

#### イベント型

##### `ScrapeEventTypes`

```typescript
type ScrapeEventTypes = {
	ignoreAndSkip: {
		pid: number | undefined;
		url: ExURL;
		reason: {
			matchedText: string;
			excludeKeywords: string[];
		};
	};
	resourceResponse: {
		pid: number | undefined;
		url: ExURL;
		log: NetworkLog;
		resource: Omit<Resource, 'uid'>;
	};
	scrapeEnd: {
		pid: number | undefined;
		url: ExURL;
		timestamp: number;
		result: PageData;
	};
	destroyed: {
		pid: number | undefined;
	};
	error: {
		pid: number | undefined;
		url: ExURL;
		shutdown: boolean;
		error: {
			name: string;
			message: string;
			stack?: string;
		};
	};
	changePhase: ChangePhaseEvent;
};
```

##### `SubProcessRunnerEventTypes`

```typescript
type SubProcessRunnerEventTypes = {
	reset: {
		pid: number | undefined;
	};
	scrapeEvent: Action<AnyScrapeEvent>;
	changePhase: SubProcessChangeEvent;
	error: {
		pid: number | undefined;
		url: ExURL;
		shutdown: boolean;
		error: {
			name: string;
			message: string;
			stack?: string;
		};
	};
};
```

### イベントアクションクリエーター

#### `scraperEvent`

スクレイパーイベントを作成するためのアクションクリエーターです。

```typescript
import { scraperEvent } from '@d-zero/beholder';

// 利用可能なイベント:
// - scraperEvent.ignoreAndSkip
// - scraperEvent.resourceResponse
// - scraperEvent.scrapeEnd
// - scraperEvent.destroyed
// - scraperEvent.error
// - scraperEvent.changePhase
```

#### `subProcessEvent`

サブプロセスイベントを作成するためのアクションクリエーターです。

```typescript
import { subProcessEvent } from '@d-zero/beholder';

// 利用可能なイベント:
// - subProcessEvent.start
// - subProcessEvent.destroy
```

## 完全な使用例

### 基本的なスクレイピング

```typescript
import Scraper from '@d-zero/beholder';
import { parseUrl } from '@d-zero/shared/parse-url';

const scraper = new Scraper();

// イベントハンドラーを設定
scraper.on('changePhase', async (event) => {
	console.log(`[${event.pid}] ${event.name}: ${event.message}`);
});

scraper.on('scrapeEnd', async (event) => {
	const { result } = event;
	console.log('タイトル:', result.meta.title);
	console.log('ステータス:', result.status);
	console.log('アンカー数:', result.anchorList.length);
	console.log('画像数:', result.imageList.length);
});

scraper.on('error', async (event) => {
	console.error('エラー:', event.error.message);
});

// スクレイピングを実行
const url = parseUrl('https://example.com');
const result = await scraper.scrapeStart(url, {
	isGettingImages: true,
	excludeKeywords: ['広告'],
	isExternal: false,
});

// クリーンアップ
await scraper.destroy(false);
```

### サブプロセスでのスクレイピング

```typescript
import { SubProcessRunner } from '@d-zero/beholder';
import { parseUrl } from '@d-zero/shared/parse-url';

const runner = new SubProcessRunner(5); // 5回ごとにリセット

// イベントハンドラーを設定
runner.on('scrapeEvent', async (action) => {
	if (action.type === '@@scraper/scrapeEnd') {
		console.log('完了:', action.payload.result.url.href);
	}
	if (action.type === '@@scraper/error') {
		console.error('エラー:', action.payload.error.message);
	}
});

runner.on('changePhase', async (event) => {
	console.log(`[${event.pid}] ${event.name}`);
});

// URLリストをスクレイピング
const urls = [
	'https://example.com',
	'https://example.com/about',
	'https://example.com/contact',
];

for (const urlString of urls) {
	const url = parseUrl(urlString);

	// サブプロセスが待機状態になるまで待つ
	while (runner.state === 'running') {
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	runner.start(
		url,
		{
			isExternal: false,
			isGettingImages: false,
			excludeKeywords: [],
			executablePath: null,
			isTitleOnly: true,
			screenshot: null,
		},
		false,
		1000,
	);
}

// 完了後にクリーンアップ
runner.destory();
```

## ライセンス

MIT

## 作者

D-ZERO
