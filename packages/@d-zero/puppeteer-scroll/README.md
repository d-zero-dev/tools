# `@d-zero/puppeteer-scroll`

`IntersectionObserver` や `loading="lazy"` を完了させるため、ページを上から下までスクロールするユーティリティ。スクロールジャック検出付き。

## Installation

```sh
yarn add @d-zero/puppeteer-scroll
```

## Usage

```ts
import { scrollAllOver } from '@d-zero/puppeteer-scroll';

await scrollAllOver(page);
```

デフォルトは人間らしい揺らぎを付けたランダム挙動。テスト・レコーディング・VRT など**決定論的な挙動が必要な場合は `interval` と `distance` を明示指定**する:

```ts
await scrollAllOver(page, { interval: 300, distance: 800 });
```

オプション・デフォルト値・スクロールジャック検出ロジック・`distance ≤ 0` の丸めについては `src/scroll-all-over.ts` の JSDoc を参照。
