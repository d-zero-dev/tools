# `@d-zero/puppeteer-page-scan`

Puppeteer でスクリーンショット・DOM スキャン前にビューポート設定・リロード・フック実行・スクロール完了までを行うヘルパー。

## Installation

```sh
yarn add @d-zero/puppeteer-page-scan
```

## Usage

```ts
import { beforePageScan, readPageHooks } from '@d-zero/puppeteer-page-scan';

await beforePageScan(page, 'https://example.com', {
	name: 'desktop',
	width: 1400,
	openDisclosures: true,
});
```

### `readPageHooks` — フックモジュールの読み込み

```ts
const hooks = await readPageHooks(['./hooks/login.mjs'], process.cwd());

await beforePageScan(page, url, { name: 'desktop', width: 1400, hooks });
```

### 子プロセスを跨ぐ場合は `PageHookSource`

IPC は関数を `null` 化するため、親 → 子で `PageHook[]` を直接渡せない。代わりに `PageHookSource`（パスの記述）を IPC で渡し、子プロセス内で `readPageHooks` を呼ぶ。詳細は `src/types.ts` の `PageHookSource` JSDoc。

```ts
// 親
const hookSource = { paths: ['./hooks/login.mjs'], baseDir: process.cwd() };

// 子
const hooks = await readPageHooks(hookSource.paths, hookSource.baseDir);
```
