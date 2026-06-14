# `@d-zero/a11y-check-scenarios`

WCAG 達成基準に基づくシナリオコレクション。[`@d-zero/a11y-check-core`](../a11y-check-core/) の `scenarioRunner` に渡して使う。

## Installation

```sh
yarn add @d-zero/a11y-check-scenarios puppeteer
```

## Usage

```ts
import { scenario01, scenario02 } from '@d-zero/a11y-check-scenarios';

// scenario01: 視覚的検証（スクリーンショット）
const result1 = await scenario01.exec(page, 'desktop', console.log);

// scenario02: ナビゲーション抽出
const result2 = await scenario02.exec(page, 'desktop', console.log);
```

各シナリオが検証する WCAG 達成基準・出力レポート構造・スクリーンショット時のマーキング規則は `src/scenario01.ts` / `src/scenario02.ts` の JSDoc を参照。
