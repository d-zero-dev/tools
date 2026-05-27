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

// デフォルトサイズ定数（desktop、tablet、mobileの3種類）
console.log(defaultSizes);
// {
//   desktop: { width: 1400 },
//   tablet: { width: 768 },
//   mobile: { width: 375, resolution: 2 }
// }
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
	scrollInterval: { random: { min: 200, max: 500 } }, // オプション: スクロール間隔（ms）
	scrollDistance: { random: { min: 300, max: 900 } }, // オプション: 1ステップで進む距離（px）
});
```

#### スクロールオプション

| オプション       | 型                       | 説明                                                                                                                                                |
| ---------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scrollInterval` | `number \| DelayOptions` | `scrollAllOver`の`interval`にそのまま渡されます。未指定時は[`@d-zero/puppeteer-scroll`](../puppeteer-scroll/README.md#デフォルト挙動)のデフォルト。 |
| `scrollDistance` | `number \| DelayOptions` | `scrollAllOver`の`distance`にそのまま渡されます。未指定時は同上。                                                                                   |

詳細は[`@d-zero/puppeteer-scroll`](../puppeteer-scroll/README.md#api)を参照。

### `readPageHooks`

ファイルパスの配列からPageHookモジュールを読み込むヘルパー関数です。各パスはESモジュールとしてインポートされ、デフォルトエクスポートを`PageHook`関数として返します。

```ts
import { readPageHooks } from '@d-zero/puppeteer-page-scan';

// hookファイルのパスからPageHook関数の配列を取得
const hooks = await readPageHooks(
	['./hooks/login.js', '/absolute/path/to/hook.js'],
	process.cwd(), // 相対パスの基準ディレクトリ
);

// beforePageScanで使用
await beforePageScan(page, 'https://example.com', {
	name: 'desktop',
	width: 1200,
	hooks,
});
```

**パラメータ:**

- `hooks`: 読み込むhookファイルのパスの配列（絶対パスまたは相対パス）
- `baseDir`: 相対パスを解決するための基準ディレクトリ

**戻り値:**

- `Promise<PageHook[]>`: PageHook関数の配列

**エラー:**

- モジュールが見つからない場合は`Error`を投げます
- デフォルトエクスポートが関数でない場合は`TypeError`を投げます

#### 子プロセスを経由する場合の使い分け

Node の IPC（`process.send`）は関数を JSON 化できず `null` に変換するため、`PageHook[]`（関数配列）を親プロセスから子プロセスへ直接渡すことはできません。`@d-zero/print` / `@d-zero/archaeologist` / `@d-zero/a11y-check` のように `@d-zero/puppeteer-dealer` を経由して子プロセスでフックを実行する場合は、**パスの記述（[`PageHookSource`](#pagehooksource)）を子プロセスに渡し、子プロセス内で `readPageHooks` を呼ぶ**設計にしてください。

```ts
// 親プロセス: PageHookSource を組み立てて IPC で渡す
const hookSource = {
	paths: ['./hooks/login.mjs'],
	baseDir: process.cwd(),
};

// 子プロセス: 受け取ったパスから関数化して beforePageScan に渡す
const hooks = await readPageHooks(hookSource.paths, hookSource.baseDir);
await beforePageScan(page, url, { name, width, hooks });
```

### `pageScanListener` と `pageScanLoggers`

ページスキャン処理中の各フェーズ（ビューポート設定、ページ読み込み、フック実行、スクロール）のログを出力するためのリスナー関数とロガー設定です。

```ts
import { pageScanListener, pageScanLoggers } from '@d-zero/puppeteer-page-scan';

// リスナーを使用（@d-zero/puppeteer-general-actionsのcreateListenerで作成済み）
const listeners = pageScanListener((message) => {
	console.log(message);
});

await beforePageScan(page, 'https://example.com', {
	name: 'desktop',
	width: 1200,
	listeners,
});

// カスタムロガーを作成する場合
import { createListener } from '@d-zero/puppeteer-general-actions';

const customListeners = createListener((log) => {
	const loggers = pageScanLoggers(log);
	return {
		...loggers,
		// 特定のフェーズをカスタマイズ
		setViewport({ width }) {
			log(`カスタム: ビューポート幅を${width}pxに変更`);
		},
	};
});
```

**ログ出力内容:**

- `setViewport`: ビューポートサイズ変更のログ
- `load`: ページ読み込み（初回/リロード）とタイムアウト情報
- `hook`: フック実行時のメッセージ
- `scroll`: スクロール位置と進捗状況（パーセンテージ）

## 型のエクスポート

### `Sizes`

デバイスサイズのマップ型です。キーはデバイス名、値は`Size`オブジェクトです。

```typescript
type Sizes = Record<string, Size>;
```

### `Size`

単一デバイスのサイズ設定です。

```typescript
type Size = {
	width: number; // ビューポート幅（ピクセル）
	resolution?: number; // デバイスピクセル比（省略時は1）
};
```

### `PageHook`

ページスキャン前に実行されるフック関数の型です。

```typescript
type PageHook = (
	page: Page,
	size: Size & {
		name: string; // デバイス名
		log: (message: string) => void; // ログ出力関数
	},
) => Promise<void>;
```

### `PageHookSource`

子プロセスにフックをIPCで渡すための「ロード元の記述」を表す型です。Node IPC は関数を `null` 化するため、`PageHook[]`（関数配列）を親→子で直接渡せません。`@d-zero/puppeteer-dealer` を経由するツールはこの形で受け渡しを行い、子プロセス内で `readPageHooks` を呼んで関数化します。

```typescript
type PageHookSource = {
	readonly paths: readonly string[]; // フックファイルのパス（絶対 or 相対）
	readonly baseDir: string; // 相対パスを解決する基準ディレクトリ
};
```

使い方は [子プロセスを経由する場合の使い分け](#子プロセスを経由する場合の使い分け) を参照してください。

### `PageScanPhase`

ページスキャン処理の各フェーズを表す型です。リスナーのコールバックで使用されます。

```typescript
type PageScanPhase = {
	setViewport: { name: string; width: number; resolution?: number };
	hook: { name: string; message: string };
	load: { name: string; type: 'open' | 'reload'; timeout: number; id: string };
	scroll: { name: string; scrollY: number; scrollHeight: number; message: string };
};
```
