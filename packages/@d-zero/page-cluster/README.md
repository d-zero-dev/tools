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

CMSのブロック属性名が分からない・サイトごとに違う場合、`autoCapMainDepth` を使う。`<main>`/`role="main"`という標準タグを起点に、構造クラスタ数が急増する直前の深さをブロックごとに実データから自動検出して打ち切るため、サイト固有の設定が一切不要（既定はtrue。無効にするには `autoCapMainDepth: false` を渡す。実データ検証では`contentBlockAttribute`より良い結果になる場合もあった。計算コストは実測で数倍〜1桁台後半。倍率はコーパスのブロック構成に依存する）。詳細は `detectContentDepthCap()` のJSDocを参照。

ブロッキング後の各ブロックを個別に処理する Stage A に加え、`resolvePageClusterKeys()` はすべてのブロックを処理した後、ブロック境界を越えた Stage B（クロスブロック統合）を常時実行する。URLパス・スタイルシート集合が異なるだけで構造的に同一テンプレートと判定できるユニットを、クォーラムコア（メンバーページの80%以上が持つコーパス識別トークン）ベースの complete-linkage・包含・シェイプ類似度（クラス名剥きトークン）とL2シグネチャ比較（シェル裏付き）を組み合わせて不動点まで反復的に統合する（実コーパスで2〜5ラウンド収束）。詳細は `mergeCrossBlockClusters()` のJSDocを参照。

header/footer/nav/asideが一致するページ同士をさらに合流させたい場合は `mergeRareLandmarkClusters: true` を使う。ただし単純な一致判定は実データで過剰融合を招くことが分かっているため（header/footer/navは99%以上のページに存在し判別力を持たない）、コーパス全体で希少なランドマークバリアントが一致した場合に限り、より緩いコンテンツ類似度閾値（`landmarkGateSimilarityThreshold`）での合流を許可する（既定はfalse。実データでの検証は未実施で、合成フィクスチャでの単体・回帰テストのみ）。詳細・コスト特性は `mergeLandmarkAffinedClusters()` のJSDocを参照。

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
