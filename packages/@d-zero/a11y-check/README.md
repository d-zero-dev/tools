# `@d-zero/a11y-check`

ウェブサイトのアクセシビリティチェック CLI。Puppeteer でページを検証し、Google スプレッドシートにレポート出力する。

## Installation

```sh
yarn add @d-zero/a11y-check
```

## Usage

```sh
npx @d-zero/a11y-check <url>... [options]
npx @d-zero/a11y-check -f <listfile> [options]
```

オプションは `--help` を参照。

### URL リストファイル

```txt
https://example.com
ID001 https://example.com/a
# コメント行
```

各 URL の手前に任意の ID を空白区切りで付与可能。`#` で始まる行はコメント。

### 設定ファイル（frontmatter）

```txt
---
hooks:
  - ./hook1.cjs
  - ./hook2.mjs
---

https://example.com
```

設定ファイルでは `hooks` のみ指定可能。その他のオプションは CLI で渡す。`hooks` は IPC 越境のためファイルパスで渡す仕様（詳細は [`@d-zero/puppeteer-page-scan`](../puppeteer-page-scan/) の `PageHookSource`）。

### ページフック

```js
/** @type {import('@d-zero/puppeteer-page-scan').PageHook} */
export default async function (page, { name, width, resolution, log }) {
	// 例: ログイン処理
	await page.type('#username', 'user');
	await page.type('#password', 'pass');
	await page.click('button[type="submit"]');
	await page.waitForNavigation();
}
```

### Google スプレッドシート出力

`-o <URL>` で出力。クレデンシャル指定は `-c <path>` または `GOOGLE_AUTH_CREDENTIALS` 環境変数（CLI 優先）。クレデンシャルファイルは Google Cloud Console の OAuth 2.0 クライアント ID（アプリ種別: **デスクトップ**）を発行してダウンロード。

### Basic 認証

URL に資格情報を含める: `https://user:pass@example.com`
