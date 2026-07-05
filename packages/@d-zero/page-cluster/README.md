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

クロールしたページ群から最終的なクラスタキーを得るには `resolvePageClusterKeys()` を使う。ブロッキング（URLパス/スタイルシートによる粗い絞り込み）と構造クラスタリング（ブロック内でのcomplete-linkage階層的クラスタリング）を内部で連結し、ブロックを跨いで一意なキーを返す。既定で各ページの`<header>`/`<footer>`/`<nav>`/`<aside>`（タグ名またはARIAランドマークロール）を比較対象から除外し、共通chromeの影響を受けにくくする。また、スタイルシート参照が記録されていない「孤児」ページを、同一URLセクションに閉じたスタイルシート・ブロックへ再割当する処理（`reassignOrphanBlockKeys()`）や、埋め込みコンテンツが引き込むサードパーティCSS参照をブロッキング判定から除外する処理（`filterFirstPartyStylesheetHrefs()`）も既定で有効。挙動の詳細・トレードオフはそれぞれのJSDocを参照。

自由編集ブロックエディタ（CMSが各コンテンツブロックに固有のdata属性を付与するタイプ）を使うサイトでは、`contentBlockAttribute` オプションでその属性名を指定すると、ページごとに異なるブロック構成が構造比較のノイズになるのを防げる（既定は未指定＝無効、サイトごとの属性名を推測できないため）。詳細は `removeContentBlocks()` のJSDocを参照。

```ts
import { resolvePageClusterKeys } from '@d-zero/page-cluster/resolve-page-cluster-keys';

const keys = resolvePageClusterKeys(
	pages.map((page) => ({
		paths: page.urlPathSegments,
		stylesheetHrefs: page.stylesheetHrefs,
		html: page.html,
	})),
	{ contentBlockAttribute: 'data-bgb' }, // 使っているCMSのブロック属性名に合わせて指定
);
// pagesと同じ順序・同じ長さ。同じキーのページが同一テンプレートと判定されたページ群
```

### ランドマークバリアント分類

「同一テンプレートか」ではなく「このページはどのヘッダー/フッター/ナビ/サイドナビを持っているか」というメタプロパティを個別に知りたい場合は `resolveLandmarkVariantKeys()` を使う。`resolvePageClusterKeys()` とは独立した戻り値で、両者の合成は呼び出し側の責務。

```ts
import { resolveLandmarkVariantKeys } from '@d-zero/page-cluster/resolve-landmark-variant-keys';

const headerVariantKeys = resolveLandmarkVariantKeys(
	pages.map((page) => page.html),
	'header',
);
// pagesと同じ順序・同じ長さ。同じキーのページが同じヘッダーデザインを持つページ群
```
