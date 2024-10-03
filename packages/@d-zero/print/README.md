# `@d-zero/print`

ウェブサイトのスクリーンショットを撮影するツールです。

- Puppeteerを実行してページのスクリーンショットを撮影します
- `png`、`pdf`、`note`の3つの形式で出力できます
- スクリーンショットはデスクトップとモバイルの2つのサイズでそれぞれ撮影します

## CLI

```sh
npx @d-zero/print -f <listfile> [--type <png|pdf|note>] [--limit <number>] [--debug]

npx @d-zero/print <url>... [--type <png|pdf|note>] [--limit <number>] [--debug]
```

リストをファイルから読み込むか、URLを直接指定して実行します。

実行した結果は`.print`ディレクトリに保存されます。

### オプション

- `-f, --file <filepath>`: URLリストを持つファイルのパス
- `<url>`: 対象のURL（複数指定可能）
- `-t, --type <png|pdf|note>`: 出力形式（デフォルト: png）
  - `png`: PNG画像（モバイルとデスクトップの2つが生成されます）
  - `pdf`: PDFファイル（ブラウザの印刷機能を使用、Print CSSが適用されます）
  - `note`: PNG画像のスクリーンショットに対してメモ欄付きのPDFファイルが生成されます
- `--limit <number>`: 並列実行数の上限（デフォルト: 10）
- `--debug`: デバッグモード（デフォルト: false）

### ファイルフォーマット

```txt
https://example.com
https://example.com/a
https://example.com/b
https://example.com/c
https://example.com/xyz/001
```

## ページフック

[Frontmatter](https://jekyllrb.com/docs/front-matter/)の`hooks`に配列としてスクリプトファイルのパスを渡すと、ページを開いた後（厳密にはPuppetterの`waitUntil: 'networkidle0'`のタイミング直後）にそれらのスクリプトを実行します。スクリプトは配列の順番通りに逐次実行されます。

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

フックスクリプトは、以下のようにエクスポートされた関数を持つモジュールとして定義します。

```js
/**
 * @type {import('@d-zero/archaeologist').PageHook}
 */
export default async function (page, { name, width, resolution, log }) {
	// 非同期処理可能
	// page: PuppeteerのPageオブジェクト
	// name: サイズ名（'desktop' | 'mobile'）
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

例のように、ページにログインする処理をフックスクリプトに記述することで、ユーザー認証が必要なページのスクリーンショットを撮影することができます。

## 認証

### Basic認証

Basic認証が必要なページの場合はURLにユーザー名とパスワードを含めます。

例: `https://user:pass@example.com`
