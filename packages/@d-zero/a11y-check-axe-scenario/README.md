# `@d-zero/a11y-check-axe-scenario`

axe-core を用いたアクセシビリティチェックシナリオ。[`@d-zero/a11y-check-core`](../a11y-check-core/) の `scenarioRunner` に渡して使う。

## Installation

```sh
yarn add @d-zero/a11y-check-axe-scenario
```

Peer dependencies: `axe-core`, `puppeteer`。

## Usage

```ts
import { scenarioAxe } from '@d-zero/a11y-check-axe-scenario';
import { scenarioRunner } from '@d-zero/a11y-check-core';

const results = await scenarioRunner(['https://example.com'], [scenarioAxe()], {
	cache: true,
	screenshot: true,
});
```

オプション（`screenshot` / `cache` / `cacheDir` / `lang`）は型定義を参照。`lang` のデフォルトは `'ja'`。
