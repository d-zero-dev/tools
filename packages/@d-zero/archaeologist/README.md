# `@d-zero/archaeologist`

**🕵️ Archaeologist: アーキオロジスト**

ウェブサイトの本番環境と開発環境や、新旧のページの比較するためのツールです。

- Puppeteerを実行してページのスクリーンショットを撮影します
- スクリーンショットはデスクトップとモバイルの2つのサイズでそれぞれ撮影します
- スクリーンショットは画像差分（ビジュアルリグレッション）を検出・出力します
- HTMLの差分も検出します

## CLI

```sh
npx @d-zero/archaeologist -f <filepath> [--limit <number>] [--debug]
```

URLリストを持つファイルを指定して実行します。

### オプション

- `-f, --file <filepath>`: URLリストを持つファイルのパス（必須）
- `--limit <number>`: 並列実行数の上限（デフォルト: 10）
- `--debug`: デバッグモード（デフォルト: false）

### ファイルフォーマット

ファイルの先頭には比較対象のホストを指定します。[Frontmatter](https://jekyllrb.com/docs/front-matter/)形式で`comparisonHost`に指定します。

```txt
---
comparisonHost: https://stage.example.com
---

https://example.com
https://example.com/a
https://example.com/b
https://example.com/c
https://example.com/xyz/001
```

上記のサンプルファイルの場合、以下のURLが比較されます。

| 比較元                        | 比較対象                            |
| ----------------------------- | ----------------------------------- |
| `https://example.com`         | `https://stage.example.com`         |
| `https://example.com/a`       | `https://stage.example.com/a`       |
| `https://example.com/b`       | `https://stage.example.com/b`       |
| `https://example.com/c`       | `https://stage.example.com/c`       |
| `https://example.com/xyz/001` | `https://stage.example.com/xyz/001` |

実行した結果は`.archaeologist`ディレクトリに保存されます。

## ページフック

[Frontmatter](https://jekyllrb.com/docs/front-matter/)の`hooks`に配列としてスクリプトファイルのパスを渡すと、ページを開いた後（厳密にはPuppetterの`waitUntil: 'networkidle0'`のタイミング直後）にそれらのスクリプトを実行します。スクリプトは配列の順番通りに逐次実行されます。

```txt
---
comparisonHost: https://stage.example.com
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
