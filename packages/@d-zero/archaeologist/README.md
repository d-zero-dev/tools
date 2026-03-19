# `@d-zero/archaeologist`

**🕵️ Archaeologist: アーキオロジスト**

ウェブサイトの本番環境と開発環境や、新旧のページの比較するためのツールです。

- Puppeteerを実行してページのスクリーンショットを撮影します
- 複数のデバイスサイズでスクリーンショットを撮影可能（7種類のプリセット + カスタム設定）
- スクリーンショットは画像差分（ビジュアルリグレッション）を検出・出力します
- HTMLの差分も検出します
- 生HTMLソースの差分も検出します（ブラウザ不要）
- レスポンシブデザインの差分検証に最適

## CLI

```sh
npx @d-zero/archaeologist -f <listfile> [options]
```

URLリストを持つファイルを指定して実行します。

### オプション

- `-v, --version`: バージョンを表示
- `-f, --listfile <filepath>`: URLリストを持つファイルのパス（必須）
- `-t, --type <types>`: 比較タイプの指定（`image,dom,text,code`、カンマ区切り）
- `-s, --selector <selector>`: 比較対象を限定するCSSセレクター
- `-i, --ignore <selector>`: 無視するCSSセレクター
- `-d, --devices <devices>`: デバイスプリセット（カンマ区切り、デフォルト: desktop-compact,mobile）
- `--freeze <filepath>`: フリーズモード用ファイルパス
- `--combined`: 環境AとBのスクリーンショットを左右に並べた合成画像を出力
- `--limit <number>`: 並列実行数の上限（デフォルト: 10）
- `--interval <ms>`: 並列実行間の間隔（デフォルト: なし）
  - 数値または"min-max"形式でランダム範囲を指定可能
- `--debug`: デバッグモード（デフォルト: false）
- `--verbose`: 詳細ログモード（デフォルト: false）

### 利用可能なデバイスプリセット

- `desktop`: 1400px幅
- `tablet`: 768px幅
- `mobile`: 375px幅（2倍解像度）
- `desktop-hd`: 1920px幅
- `desktop-compact`: 1280px幅
- `mobile-large`: 414px幅（3倍解像度）
- `mobile-small`: 320px幅（2倍解像度）

### 比較タイプ

`-t` オプションで指定する比較タイプの詳細:

| タイプ  | 説明                                                                                   | ブラウザ |
| ------- | -------------------------------------------------------------------------------------- | -------- |
| `image` | スクリーンショットのピクセル単位のビジュアル差分                                       | 必要     |
| `dom`   | ブラウザでレンダリングされた後のDOMツリーの差分（JavaScript実行後の状態）              | 必要     |
| `text`  | ページのテキストコンテンツの差分（形態素解析による比較）                               | 必要     |
| `code`  | HTTPで取得した生HTMLソースの差分（JavaScript実行前の状態、デバイスサイズに依存しない） | 不要     |

デフォルトではすべてのタイプが有効です。`code` のみを指定した場合はブラウザを起動せずに実行されます。

### 使用例

```sh
# デフォルトデバイス（desktop-compact, mobile）
npx @d-zero/archaeologist -f urls.txt

# カスタムデバイス指定
npx @d-zero/archaeologist -f urls.txt --devices desktop,tablet,mobile

# 合成画像を出力（2つの環境のスクリーンショットを左右に並べて表示）
npx @d-zero/archaeologist -f urls.txt --combined

# 生HTMLソースの差分のみ比較（ブラウザ不要）
npx @d-zero/archaeologist -f urls.txt -t code

# 画像差分と生HTMLソース差分を併用
npx @d-zero/archaeologist -f urls.txt -t image,code

# フリーズモード（参照用スクリーンショット作成）
npx @d-zero/archaeologist --freeze urls.txt
```

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

[Frontmatter](https://jekyllrb.com/docs/front-matter/)の`hooks`に配列としてスクリプトファイルのパスを渡すと、ページを開いた後（厳密にはPuppeteerの`waitUntil: 'networkidle0'`のタイミング直後）にそれらのスクリプトを実行します。スクリプトは配列の順番通りに逐次実行されます。

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
