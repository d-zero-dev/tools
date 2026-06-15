# `@d-zero/a11y-check-core`

Puppeteer でページをスキャンし、WCAG 準拠のアクセシビリティ違反を検出するシナリオ実行エンジン。シナリオ自体は別パッケージ（[`@d-zero/a11y-check-axe-scenario`](../a11y-check-axe-scenario/) / [`@d-zero/a11y-check-scenarios`](../a11y-check-scenarios/)）が提供する。

## Installation

```sh
yarn add @d-zero/a11y-check-core
```

## Usage

```ts
import { scenarioRunner, createScenario } from '@d-zero/a11y-check-core';
import { scenarioAxe } from '@d-zero/a11y-check-axe-scenario';

const result = await scenarioRunner(['https://example.com'], [scenarioAxe()], {
	cache: true,
	screenshot: true,
});

console.log(result.violations.length);
```

カスタムシナリオは `createScenario` で定義する:

```ts
const myScenario = createScenario('my-scenario', async (page, sizeName) => {
	// チェックロジック
	return { passed: [], violations: [], needAnalysis: [] };
});
```

シナリオベース設計の WHY、結果分類（Passed / Violation / NeedAnalysis）、キャッシュキー仕様は `src/scenario-runner.ts` / `src/create-scenario.ts` / `src/types.ts` の JSDoc を参照。
