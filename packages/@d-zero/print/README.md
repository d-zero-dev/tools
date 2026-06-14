# `@d-zero/print`

Puppeteer でマルチデバイス対応のスクリーンショットを撮影する CLI / ライブラリ。`png` / `pdf` / `note`（メモ欄付き PDF）に対応。

## Installation

```sh
yarn add @d-zero/print
```

## Usage

```sh
npx @d-zero/print <url>... [options]
npx @d-zero/print -f <listfile> [options]
```

オプションは `--help`、デバイスプリセットは [`@d-zero/puppeteer-page-scan`](../puppeteer-page-scan/) を参照。

### URL リストファイル

```txt
https://example.com
ID:ABC https://example.com/c
# コメント
```

ID 未指定の場合は連番（1 から、3 桁ゼロパディング）が振られる。

### Frontmatter で hook 指定

```txt
---
hooks:
  - ./hook1.mjs
---

https://example.com
```

`hooks` ファイルパスを通じて Puppeteer 実行側プロセスでフックが実行される。IPC 越境のため**関数配列ではなくパスを渡す**仕様（詳細は [`@d-zero/puppeteer-page-scan`](../puppeteer-page-scan/) の `PageHookSource`）。

### Basic 認証

URL に資格情報を含める: `https://user:pass@example.com`

### `--open-disclosures`

撮影前に `<details>` と `button[aria-expanded="false"]` をすべて展開。最大 1000 イテレーション・各 500ms 待機。終了条件と制限の WHY は `src/print.ts` の JSDoc を参照。

### スクロール挙動

未指定時は人間らしいランダム化が掛かる。**決定論が必要な場合（VRT、レコーディング、比較など）は `scrollInterval` / `scrollDistance` を明示**する。詳細は [`@d-zero/puppeteer-scroll`](../puppeteer-scroll/)。

## Library

```ts
import { print } from '@d-zero/print';

await print(['https://example.com'], {
	type: 'png',
	devices: { desktop: { width: 1400 }, mobile: { width: 375, resolution: 2 } },
	hooks: {
		paths: ['./hooks/login.mjs'],
		baseDir: process.cwd(),
	},
});
```

`hooks` は `PageHookSource`（パス + baseDir）形式で渡す。詳細は [MIGRATION-page-hooks.md](../../../MIGRATION-page-hooks.md)。
