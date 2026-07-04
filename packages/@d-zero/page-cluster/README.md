# `@d-zero/page-cluster`

大量クローリングした HTML の重複・類似ページ検出のためのパッケージ。`tokenize()` は `<body>` 配下のHTMLを、テキストを除去した構造トークンに変換する。用途・設計判断のWHYは `src/tokenize.ts` の JSDoc を参照。

## Installation

```sh
yarn add @d-zero/page-cluster
```

## Usage

```ts
import { tokenize } from '@d-zero/page-cluster';

const { tokens, bodyClassList } = tokenize(
	'<body class="law-page"><div class="card"><ul><li>A</li><li>B</li></ul></div></body>',
);
// tokens: ["body>.card>ul>li", "body>.card>ul>li"]
// bodyClassList: ["law-page"]
```

### オプション

```ts
tokenize(html, {
	filterNoiseClasses: true, // 既定値。ハッシュ的自動生成class名を除外する
	includeComments: false, // 既定値。コメントノードをトークン化しない
});
```

### クラスタリング

クロールしたページ群から最終的なクラスタキーを得るには `resolvePageClusterKeys()` を使う。ブロッキング（URLパス/スタイルシートによる粗い絞り込み）と構造クラスタリング（ブロック内でのcomplete-linkage階層的クラスタリング）を内部で連結し、ブロックを跨いで一意なキーを返す。

```ts
import { resolvePageClusterKeys, tokenize } from '@d-zero/page-cluster';

const keys = resolvePageClusterKeys(
	pages.map((page) => ({
		paths: page.urlPathSegments,
		stylesheetHrefs: page.stylesheetHrefs,
		tokens: new Set(tokenize(page.html).tokens),
	})),
);
// pagesと同じ順序・同じ長さ。同じキーのページが同一テンプレートと判定されたページ群
```
