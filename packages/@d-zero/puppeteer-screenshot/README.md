# `@d-zero/puppeteer-screenshot`

Puppeteerでスクリーンショットを撮るためのユーティリティです。

## インストール

```sh
yarn install @d-zero/puppeteer-screenshot
```

## 使い方

### 基本的な使い方

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
});
```

### リスナーを使ったロギング

```ts
import { screenshot, screenshotListener } from '@d-zero/puppeteer-screenshot';

const result = await screenshot(page, 'https://example.com', {
	listener: screenshotListener, // 標準のログ出力リスナー
});

// またはカスタムリスナー
const result = await screenshot(page, 'https://example.com', {
	listener: (phase, data) => {
		console.log(phase, data);
	},
});
```

## オプション

| オプション        | 型                          | 説明                                                                                                                                                  |
| ----------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | `string`                    | スクリーンショットのカスタム識別子。省略時はURLからファイル名が生成されます                                                                           |
| `path`            | `string`                    | スクリーンショットの保存先パス。指定するとファイルに保存されます（例: `path/to/save.png`はサイズ別に`save@desktop.png`、`save@mobile.png`などに保存） |
| `sizes`           | `Sizes`                     | スクリーンショットを撮るサイズと解像度の設定。省略時はデフォルトサイズ（desktop、tablet、mobile）が使用されます                                       |
| `hooks`           | `PageHook[]`                | ページスキャン時に実行するフック関数の配列                                                                                                            |
| `listener`        | `Listener<ScreenshotPhase>` | スクリーンショット処理の各フェーズをリスンする関数。`screenshotListener`を使うと標準のログ出力が得られます                                            |
| `domOnly`         | `boolean`                   | `true`の場合、スクリーンショットの撮影をスキップしてDOMのみを取得します（デフォルト: `false`）                                                        |
| `selector`        | `string`                    | 特定の要素のみをスクリーンショット撮影するためのCSSセレクター                                                                                         |
| `ignore`          | `string`                    | スクリーンショットから除外する（非表示にする）要素のCSSセレクター                                                                                     |
| `timeout`         | `number`                    | カスタムタイムアウト値（ミリ秒）                                                                                                                      |
| `openDisclosures` | `boolean`                   | `true`の場合、disclosure要素（`<details>`と`button[aria-expanded="false"]`）を展開します（最大1000回まで繰り返す）                                    |

## エクスポート

### `screenshot(page, url, options?)`

指定されたURLのページのスクリーンショットを撮影します。

### `screenshotListener`

スクリーンショット処理のログを標準出力に出力するための事前設定されたリスナー関数です。

```ts
import { screenshot, screenshotListener } from '@d-zero/puppeteer-screenshot';

const result = await screenshot(page, 'https://example.com', {
	listener: screenshotListener,
});
```

## 型のエクスポート

### `Screenshot`

`screenshot`関数の戻り値の型です。サイズごとのスクリーンショット結果を含むオブジェクトです。

```ts
type Screenshot = {
	id: string; // スクリーンショットの識別子
	filePath: string | null; // 保存先ファイルパス（pathオプション指定時）
	url: string; // 対象URL
	title: string; // ページタイトル
	binary: Uint8Array | null; // スクリーンショットのバイナリデータ
	dom: string; // ページのDOM文字列
	text: {
		textContent: string; // ページのテキストコンテンツ
		altTextList: readonly string[]; // 画像のalt属性リスト
	};
} & Size; // サイズ情報（width, height, resolution）
```

### `ScreenshotPhase`

リスナー関数に渡されるフェーズの型です。

### `PageHook`

`@d-zero/puppeteer-page-scan`から再エクスポートされるページフック関数の型です。
