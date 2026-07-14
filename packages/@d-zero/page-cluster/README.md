# `@d-zero/page-cluster`

大量クロール HTML の重複・類似ページを構造トークンで検出するパッケージ。CLI が主、ライブラリ関数群がオマケ。

## What this does

`page-cluster` は HTML ページ集合を受け取って、**同一テンプレートと判定できるページ**に同じキーを振る。テキストは無視して DOM 構造だけを見るので、記事本文が違うが同じテンプレートを使うページ群は 1 つのクラスタにまとまる。単一サイトで数万〜十数万ページ規模のクロール成果物を、テンプレート単位に畳んで概観したいときに使う。

## Install

```sh
yarn add @d-zero/page-cluster
```

インストールすると `page-cluster` コマンドが `node_modules/.bin/` 配下に入る。

## Quickstart (CLI)

**入力**: JSONL 1 行 1 ページ。フィールドは以下。`html` 以外はすべて任意（`paths` / `stylesheetHrefs` がないと粗い分類になる）。

```json
{
	"id": "任意の識別子",
	"html": "<html>...</html>",
	"paths": ["news", "1"],
	"stylesheetHrefs": ["/a.css"],
	"host": "example.com"
}
```

**出力**: JSONL 1 行 1 ページ、入力順。

```json
{ "id": "任意の識別子", "clusterKey": "..." }
```

### クローラ出力（JSON 配列）を JSONL に変換して食わせる

`jq` のワンライナーで配列を line-delimited にする典型例:

```sh
jq -c '.[]' crawl-output.json | page-cluster > clusters.jsonl
```

### `--content-block-attribute`

CMS が自由編集コンテンツブロックに付与している属性名（例: `data-bgb`）が分かっている場合に指定する。指定すると比較前にその属性を持つ要素配下を無視するので、同じテンプレートで本文構成だけ違うページを混同しなくなる。

```sh
page-cluster --content-block-attribute data-bgb < pages.jsonl > clusters.jsonl
```

### 進捗

処理中は stderr に進捗を出す。stdout の JSONL 出力は影響を受けない。

**対話端末 (TTY)**: `%earth%` アニメ付きの単一ヘッダー行が in-place に書き換わり、現在のフェーズ・進捗・経過時間を表示する。

```
🌏 page-cluster — clustering 12/47 blocks (elapsed 23s)
```

**非TTY (パイプ・ファイルリダイレクト・CI)**: `[page-cluster] ...` 形式の行を追記する。`pass0:` / `pass1:` / `pass1b:` / `stage-b:` の phase トークンを含むので `grep` / `awk` 互換。

```
[page-cluster] reading input pages...
[page-cluster] read 10000 pages, clustering...
[page-cluster] pass0: 10000 pages read
[page-cluster] pass1: clustered block 12/47
[page-cluster] pass1b: 30000/70000 pages assigned
[page-cluster] stage-b: merging 47 units
[page-cluster] done — 10000 pages in 47 clusters (elapsed 87s)
```

silence したい場合は `2>/dev/null`。ログに残したい場合は `2> progress.log`。

## API (brief)

すべての詳細は各関数の JSDoc にある。CLI 経由で十分な場合は読み飛ばして OK。

- **`tokenize(html, options?)`** — `<body>` 配下の HTML を構造トークン列に変換する低レベルプリミティブ
- **`resolvePageClusterKeys(pagesFactory, options?)`** — ページ集合からクラスタキーを返すメインエントリー。ファクトリ関数入力で大規模コーパスに対応
- **`resolvePageClusterKeysFromArray(pages, options?)`** — メモリに全ページ載る前提の array 入力ラッパー
- **`resolveLandmarkVariantKeys(htmlList, landmarkType, options?)`** — `header` / `footer` / `nav` / `aside` などのランドマークバリアント分類
- **`extractLandmarks(html)`** — 1 ページから 6 種の HTML5 ランドマーク（header / footer / nav / aside / form / search）を抽出

## Algorithm

```
              ┌────────────────────────────────────────┐
              │  Blocking (paths / stylesheet 集合)    │
              └──────────────────┬─────────────────────┘
                                 │  同じテンプレートを共有する候補群
                                 ▼
              ┌────────────────────────────────────────┐
              │  Stage A: complete-linkage クラスタリング │
              │     (ブロック内、Jaccard 距離)          │
              └──────────────────┬─────────────────────┘
                                 │  各ブロックのクラスタ代表
                                 ▼
              ┌────────────────────────────────────────┐
              │  Stage B: quorum-core cross-block merge │
              │  (ブロック境界を越えた再統合)            │
              └────────────────────────────────────────┘
```

- **Blocking** — URL パスと stylesheet 集合を安価なブロッキング信号として粗く分割。同一ブロック内でだけ高価な構造比較を行うので、コーパス全体に対する比較コストを O(n²) から劇的に減らす
- **Stage A** — ブロック内で `<main>` 配下のトークン列に対して complete-linkage 階層的クラスタリングを実行し、max-gap detection でカット高を選ぶ
- **Stage B** — 各クラスタの quorum-core（80% クォーラム）を代表としてブロック境界をまたぐ再統合を反復。complete-linkage、包含、shape-Jaccard、L2 signature の 4 経路で融合を試みて不動点まで回す
- **大規模自動切替** — 20,000 ページ超で自動的に**ストリーミング経路**に切り替わる。ブロックごとにリザーバサンプルで代表を学ばせ、非サンプルページを Jaccard で最寄りクラスタに割当。メモリ使用量が最大ブロックのサイズに比例するようになる

### Self-tuning

閾値はすべて **max-gap auto-cut**（度数分布の最大ギャップの中点を境界とする）でデータから自己発見される。Stage A のマージ高さカット、Stage B のシェル判定、コーパス全体の共通クローム判定など、3 階層でこの同一プリミティブを再帰使用しているので、サイトごとにハイパーパラメータをチューニングする必要はない。詳細は `autoCutThreshold` の JSDoc を参照。

## Notes

### `contentBlockAttribute` の存在意義

このパッケージが持つ唯一の site-specific なオプション。CMS の自由編集ブロックに付与される属性名（例: `data-bgb`）は HTML から自動検知できないので外部知識として受け取る形にしている。指定された属性を持つ要素の配下は比較対象から除外され、同じテンプレート上で本文構成だけ違うページの誤分割を防ぐ。

未指定でも大半のケースで動くよう、`<main>` / `role="main"` を起点にした自動深さキャップが常時有効になっている。
