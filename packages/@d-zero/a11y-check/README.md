# `@d-zero/a11y-check`

ウェブサイトのアクセシビリティチェックを行うツールです。

- Puppeteerを使用してページのアクセシビリティを検証します
- Googleスプレッドシートに詳細なレポートを出力します
- 複数のシナリオ（axe、01、02）でチェックを実行可能
- スクリーンショット機能付き

## CLI

```sh
npx @d-zero/a11y-check -f <listfile> [options]
npx @d-zero/a11y-check <url>... [options]
```

リストをファイルから読み込むか、URLを直接指定して実行します。

### オプション

- `-f, --listfile <file>`: URLリストを持つファイルのパス
- `<url>`: 対象のURL（複数指定可能）
- `-s, --screenshot`: スクリーンショットを撮影する（デフォルト: false）
- `-o, --out <url>`: GoogleスプレッドシートのURL（デフォルト: 標準出力）
- `--scenarios <scenarios>`: チェックシナリオ（カンマ区切り、利用可能: axe,01,02、デフォルト: axe）
- `--cache <true|false>`: キャッシュを使用する（デフォルト: true）
- `--cacheDir <dir>`: キャッシュディレクトリ（デフォルト: .cache）
- `--locale <locale>`: ロケール設定
- `--limit <number>`: 並列実行数の上限
- `--debug`: デバッグモード（デフォルト: false）
- `--verbose`: 詳細ログモード（デフォルト: false）

### 使用例

```sh
# 基本的な使用
npx @d-zero/a11y-check https://example.com

# ファイルから読み込み
npx @d-zero/a11y-check -f urls.txt

# スクリーンショット付きで実行
npx @d-zero/a11y-check https://example.com --screenshot

# 結果をGoogleスプレッドシートに出力
npx @d-zero/a11y-check -f urls.txt -o https://docs.google.com/spreadsheets/d/xxx/edit
```

#### URLリストのファイルフォーマット

```txt
https://example.com
https://example.com/a
https://example.com/b
ABC https://example.com/c
XYZ https://example.com/xyz/001
# コメント
# https://example.com/d
```

URLの手前に任意のIDを付与することができます。ホワイトスペースで区切ることでIDとURLを分けることができます。
IDが指定されていない場合は、URLのみが記録されます。

`#`で始まる行はコメントとして無視されます。

## 設定ファイル

Frontmatterを使用してページフックを設定できます。

```txt
---
hooks:
  - ./hook1.cjs
  - ./hook2.mjs
---

https://example.com
https://example.com/a
︙
```

**注意**: 設定ファイルでは`hooks`のみ設定可能です。その他のオプション（`scenarios`, `screenshot`, `locale`, `cache`, `cacheDir`など）はCLIオプションとして指定してください。

### 利用可能なシナリオ

- `axe`: axe-coreを使用したアクセシビリティチェック
- `01`: カスタムシナリオ01
- `02`: カスタムシナリオ02

### ページフック

`hooks`に配列としてスクリプトファイルのパスを渡すと、ページを開いた後にそれらのスクリプトを実行します。

```js
/**
 * @type {import('@d-zero/puppeteer-page-scan').PageHook}
 */
export default async function (page, { name, width, resolution, log }) {
	// 非同期処理可能
	// page: PuppeteerのPageオブジェクト
	// name: サイズ名
	// width: ウィンドウ幅
	// resolution: 解像度
	// log: ロガー

	// ログイン処理の例
	log('login');
	await page.type('#username', 'user');
	await page.type('#password', 'pass');
	await page.click('button[type="submit"]');
	await page.waitForNavigation();
	log('login done');
}
```

## Googleスプレッドシート出力

`-o`オプションでGoogleスプレッドシートのURLを指定すると、詳細なレポートが出力されます。

### 必要な環境変数

Googleスプレッドシートに出力するには、以下の環境変数が必要です：

```bash
export GOOGLE_AUTH_CREDENTIALS='/path/to/credential.json'
```

クレデンシャルファイルは、Google Cloud Consoleの[APIとサービス](https://console.cloud.google.com/apis/credentials)から**OAuth 2.0 クライアント ID**（アプリケーションの種類は**デスクトップ**）を発行してダウンロードします。

### 出力されるレポート項目

- No.: 連番
- 対象画面URL: チェック対象のURL
- テスト方法: 使用したシナリオ
- 日時: チェック実行日時
- パーツ: コンポーネント名
- 環境: 実行環境
- 対象箇所: 問題のある要素
- AS IS: 現在の状態
- TO BE: 改善すべき状態
- TO BE(補足): 補足説明
- WCAGバージョン: WCAGのバージョン
- 達成基準番号: WCAGの達成基準
- 適合レベル: A/AA/AAA
- スクリーンショット: スクリーンショットのURL

## 認証

### Basic認証

Basic認証が必要なページの場合はURLにユーザー名とパスワードを含めます。

例: `https://user:pass@example.com`
