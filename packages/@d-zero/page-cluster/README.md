# `@d-zero/page-cluster`

大量クローリングした HTML の重複・類似ページ検出のためのパッケージ。`tokenize()` は `<body>` 配下のHTMLを、テキストを除去した構造トークン配列に変換する。用途・設計判断のWHYは `src/tokenize.ts` の JSDoc を参照。

## Installation

```sh
yarn add @d-zero/page-cluster
```

## Usage

```ts
import { tokenize } from '@d-zero/page-cluster';

const tokens = tokenize(
	'<body><div class="card"><ul><li>A</li><li>B</li></ul></div></body>',
);
// ["body>.card>ul>li", "body>.card>ul>li"]
```

### オプション

```ts
tokenize(html, {
	filterNoiseClasses: true, // 既定値。ハッシュ的自動生成class名を除外する
	includeComments: false, // 既定値。コメントノードをトークン化しない
});
```
