# `@d-zero/anatomist`

URL を実際にブラウザでレンダリングし、main コンテンツ配下の子ブロックを「縦積み・横並び・シンプルgrid・複雑grid・テーブル・float画像+テキスト」のレイアウトパターンに分類して、ブロックごとの座標・innerHTML を含む再帰的な JSON ツリーとして出力するパッケージ。判定は `getComputedStyle` ではなく `getBoundingClientRect` で測定した実際の座標配置を主軸に行い、CSS プロパティ（`display` / `float` 等）は判定の裏付け情報として `signals` に残す。`page-cluster` で見つけたクラスタの代表ページのような、個別 URL のレイアウト構造を機械的に把握したいときに使う。CLI が主、ライブラリ関数群がオマケ。

## Installation

```sh
yarn add @d-zero/anatomist
```

インストールすると `anatomist` コマンドが `node_modules/.bin/` 配下に入る。

## Usage

### CLI

```sh
anatomist [options] < urls.txt > results.jsonl
```

**入力**: 1 行 1 URL（`#` 始まりの行と空行は無視）。`--input-format json` で JSON 配列も受け付ける。

**出力**: JSONL 1 行につき「1 URL × 1 ビューポート」。既定のビューポートは PC(1280px) → タブレット(768px) → モバイル(375px) の順。

```json
{
	"url": "https://example.com/",
	"viewport": { "name": "pc", "width": 1280 },
	"mainSelector": "main#content",
	"root": {
		"layoutType": "horizontal-row",
		"tagName": "DIV",
		"id": null,
		"classList": ["cards"],
		"boundingBox": { "x": 0, "y": 0, "width": 960, "height": 220 },
		"innerHTML": "...",
		"confidence": 0.8,
		"signals": { "rowCount": 1, "childCount": 3 },
		"children": [/* 同じ形の LayoutBlock が再帰的に続く */]
	}
}
```

main 要素が見つからなかった場合は `mainSelector: null, root: null`。

`layoutType` は視覚的な配置パターン（座標から読み取れる見た目）を表し、CSS の実装手段（`flex` か `grid` か `inline-block` か）とは独立している。実装手段は常に `signals` に生値として残るので、両方を突き合わせられる。`leaf` は「子要素がなく判定不要」、`unknown` は「子要素はあるがどのパターンにも自信を持って割り当てられなかった」を意味し、両者は区別される。

#### オプション

- `--input, -f <path>` — URL リストファイル（省略時は stdin）
- `--input-format <lines|json>` — 既定 `lines`
- `--main-selector <selector>` — main 要素の自動探索をスキップし、指定セレクタのみで解決する
- `--viewport <name:width>` — 複数指定可。既定プリセットを完全に置き換える（高さは幅から自動算出されるため指定不可）
- `--max-depth <n>` — 分類の最大深度（既定 6）。単一子のラッパー要素はこの深度にカウントされない
- `--min-area <px>` — 「意味のある子要素」とみなす最小面積（既定 800）
- `--inner-html <all|leaf-only|none>` — 各ブロックの `innerHTML` を含める範囲。既定 `all`（親子で内容が重複することを許容し、各ブロック単体で内容が分かることを優先する）
- `--no-bounding-box` — 出力から `boundingBox` を除く
- `--concurrency <n>` — 同時に処理する URL 数（既定 1、1 ブラウザの複数タブで並列化）
- `--timeout <ms>` — ビューポートごとのナビゲーションタイムアウト
- `--max-scroll-height <px>` — このスクロール高さを超えるページは全体スクロールをスキップする（`beforePageScan` のガードをそのまま利用）
- `--out <path>` — 結果を標準出力ではなくファイルに書き出す
- `--pretty` — 各結果を整形（2 スペースインデント）
- `--help` / `--version`

#### レイアウト判定でカバーしない範囲

- `<iframe>` の内部（別ドキュメントのため）、Shadow DOM 内部は走査しない
- `position: absolute/fixed` の要素は行/列クラスタリングの対象から除外する
- タブ UI（`role="tab"` 等）の非選択パネルは展開されない（`<details>` / `aria-expanded="false"` のみ強制展開する）ため、`display: none` のまま解析対象外になる
- カルーセル対策のオーバーフロー検知（`resolve-layout-type.ts` の `checkOverflow`）は「子要素群が親の1.5倍を超えてはみ出す」という単一のヒューリスティックであり、`transform` によるスライダー実装は捕捉できるが、`position: sticky/fixed` や `zoom`/`scale` 変形など他の「座標が実際の見た目とズレる」CSS パターンは対象外（`transform` / `overflow` / `position: sticky` はそもそも計測していない）。新しいパターンが見つかるたびにこの比率を調整するのではなく、これは既知の限定的な安全装置として扱う

### Library

サブパスエクスポート構成。

| import パス                              | 提供 API                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `@d-zero/anatomist`                      | `analyzePageLayout` — 1 URL を複数ビューポートで解析するメインエントリー       |
| `@d-zero/anatomist/capture-layout`       | `captureLayout` — Puppeteer の `Page` から main 配下の座標・スタイルを採取する |
| `@d-zero/anatomist/classify-layout-tree` | `classifyLayoutTree` — 採取済みツリーからレイアウトパターンを判定する純粋関数  |
| `@d-zero/anatomist/types`                | 型のみ — `LayoutAnalysisResult` / `ViewportSpec` / `LayoutBlock` 等            |

```ts
import puppeteer from 'puppeteer';
import { analyzePageLayout } from '@d-zero/anatomist';

const browser = await puppeteer.launch();
const page = await browser.newPage();
const results = await analyzePageLayout(page, 'https://example.com/');
for (const { viewport, root } of results) {
	console.log(viewport.name, root?.layoutType);
}
await browser.close();
```

`classifyLayoutTree` は DOM/ブラウザに依存しない純粋関数なので、`captureLayout` が返した `RawLayoutNode` ツリー（または自分で組み立てたもの）を渡すだけで単体テストできる。
