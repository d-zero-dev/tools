# `@d-zero/archaeologist`

ウェブサイトの本番と開発、新旧ページなどを比較する CLI。Puppeteer でレンダリング後のスクリーンショット・DOM・テキストを比較する他、生 HTML（`code` タイプ）はブラウザ不要で比較する。

## Installation

```sh
yarn add @d-zero/archaeologist
```

## Usage

```sh
npx @d-zero/archaeologist <urlA> <urlB> [options]
npx @d-zero/archaeologist -f <listfile> [options]
```

オプションは `--help`、デバイスプリセットは `src/devices.ts` を参照。

### 比較タイプ（`-t`）

| タイプ  | 内容                                     | ブラウザ |
| ------- | ---------------------------------------- | -------- |
| `image` | ピクセル単位の VRT                       | 必要     |
| `dom`   | レンダリング後の DOM 差分（JS 実行後）   | 必要     |
| `text`  | テキスト差分（形態素解析）               | 必要     |
| `code`  | HTTP で取得した生 HTML 差分（JS 実行前） | 不要     |

**`code` のみを指定するとブラウザを起動しない**（高速、デバイスサイズ非依存）。理由・実装は `src/cli.ts` の関連 JSDoc を参照。

### フリーズモード（`--freeze`）

将来の比較用に「参照スクリーンショット」を作成して保存する。後続の通常実行はこれを比較元として使う。

### ファイルフォーマット

```txt
---
comparisonHost: https://stage.example.com
hooks:
  - ./hook1.mjs
---

https://example.com
https://example.com/a
```

`hooks` の IPC 越境制約は [`@d-zero/puppeteer-page-scan`](../puppeteer-page-scan/) の `PageHookSource` を参照。

### Basic 認証

URL に資格情報を含める: `https://user:pass@example.com`。`code` タイプは HTTP リクエストに `Authorization` ヘッダを付与し、リダイレクト後も維持する（コードを見ても分かりにくい挙動なので注意）。詳細は `src/code-compare.ts` の JSDoc。
