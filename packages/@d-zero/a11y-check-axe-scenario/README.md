# @d-zero/a11y-check-axe-scenario

axe-core を使用したアクセシビリティチェック用のシナリオパッケージです。

## インストール

```bash
npm install @d-zero/a11y-check-axe-scenario
```

### Peer Dependencies

このパッケージを使用するには、以下のピア依存関係をインストールする必要があります。

```bash
npm install axe-core puppeteer
```

または、yarn を使用する場合:

```bash
yarn add axe-core puppeteer
```

## 概要

`@d-zero/a11y-check-axe-scenario` は、[axe-core](https://github.com/dequelabs/axe-core) と Puppeteer を統合したアクセシビリティチェックシナリオを提供します。axe-core は、Deque Systems が開発したアクセシビリティテストエンジンで、WCAG（Web Content Accessibility Guidelines）に準拠したアクセシビリティ検証を自動的に実行します。

このパッケージは、`@d-zero/a11y-check-core` のシナリオシステムに統合されており、以下の機能を提供します：

- **axe-core による自動アクセシビリティチェック**: WCAG 2.0/2.1 の達成基準に基づいた検証
- **キャッシュ機構**: 検証結果のキャッシュによる高速化
- **多言語対応**: axe-core のロケール設定をサポート（デフォルト: 日本語）
- **スクリーンショット機能**: 違反箇所のスクリーンショット取得
- **WCAG 準拠レポート**: 達成基準番号、レベル（A/AA/AAA）、重要度を含む詳細レポート

## scenarioAxe の使い方

`scenarioAxe` は、`@d-zero/a11y-check-core` の `createScenario` を使用して作成されたシナリオ関数です。

### 基本的な使用方法

```typescript
import { scenarioAxe } from '@d-zero/a11y-check-axe-scenario';

// オプションなしで使用
const scenario = scenarioAxe();

// オプションを指定して使用
const scenario = scenarioAxe({
	screenshot: true,
	cache: true,
	cacheDir: './cache',
	lang: 'ja',
});
```

### シナリオの実行

シナリオは `@d-zero/a11y-check-core` の `scenarioRunner` を通じて実行されます:

```typescript
import { scenarioAxe } from '@d-zero/a11y-check-axe-scenario';
import { scenarioRunner } from '@d-zero/a11y-check-core';

const results = await scenarioRunner(['https://example.com'], [scenarioAxe()], {
	cache: true,
	screenshot: true,
});

console.log(`${results.violations.length} 件の違反が検出されました`);
```

## A11yCheckAxeOptions の説明

`A11yCheckAxeOptions` は、axe シナリオの動作を制御するオプションです。`CoreOptions` を拡張しており、以下のプロパティが利用可能です。

### プロパティ

#### `screenshot` (boolean, オプション)

違反が検出された要素のスクリーンショットを取得するかどうかを指定します。

- デフォルト: `false`
- `true` に設定すると、各違反箇所の視覚的なスクリーンショットが Base64 エンコードされて結果に含まれます

```typescript
const scenario = scenarioAxe({
	screenshot: true,
});
```

#### `cache` (boolean, オプション)

axe-core の実行結果をキャッシュするかどうかを指定します。

- デフォルト: `true`
- `false` に設定すると、キャッシュがクリアされ、常に新しいチェックが実行されます
- キャッシュキーは `URL + '#' + サイズ名` で生成されます

```typescript
const scenario = scenarioAxe({
	cache: false, // キャッシュを無効化
});
```

#### `cacheDir` (string, オプション)

キャッシュファイルを保存するディレクトリのパスを指定します。

- デフォルト: `.cache/a11y-check/axe`（相対パス）
- 指定したディレクトリが存在しない場合は自動的に作成されます

```typescript
const scenario = scenarioAxe({
	cacheDir: './my-cache/axe-results',
});
```

#### `lang` (string, オプション)

axe-core のロケール設定を指定します。エラーメッセージやヘルプテキストの言語が変わります。

- デフォルト: `'ja'`（日本語）
- axe-core がサポートする任意のロケールコードを指定可能（例: `'en'`, `'fr'`, `'de'` など）

```typescript
const scenario = scenarioAxe({
	lang: 'en', // 英語のメッセージを使用
});
```

## 使用例

### 例 1: 基本的なチェック

```typescript
import { scenarioAxe } from '@d-zero/a11y-check-axe-scenario';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://example.com');

const scenario = scenarioAxe();
const result = await scenario.exec(page, 'desktop', (message) => console.log(message));

console.log(`${result.violations.length} 件の違反が検出されました`);

await browser.close();
```

### 例 2: スクリーンショット付きチェック

```typescript
import { scenarioAxe } from '@d-zero/a11y-check-axe-scenario';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://example.com');

const scenario = scenarioAxe({
	screenshot: true,
	lang: 'ja',
});

const result = await scenario.exec(page, 'desktop', (message) => console.log(message));

// スクリーンショットを保存
for (const [index, violation] of result.violations.entries()) {
	if (violation.screenshot) {
		const base64Data = violation.screenshot.replace(/^data:image\/png;base64,/, '');
		await fs.writeFile(`violation-${index}.png`, Buffer.from(base64Data, 'base64'));
	}
}

await browser.close();
```

### 例 3: キャッシュを無効化して毎回チェック

```typescript
import { scenarioAxe } from '@d-zero/a11y-check-axe-scenario';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://example.com');

const scenario = scenarioAxe({
	cache: false, // 毎回新しいチェックを実行
	lang: 'ja',
});

const result = await scenario.exec(page, 'desktop', (message) => console.log(message));

await browser.close();
```

### 例 4: カスタムキャッシュディレクトリと英語メッセージ

```typescript
import { scenarioAxe } from '@d-zero/a11y-check-axe-scenario';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://example.com');

const scenario = scenarioAxe({
	cacheDir: './test-cache/a11y',
	lang: 'en',
	screenshot: true,
});

const result = await scenario.exec(page, 'mobile', (message) => console.log(message));

// 違反の詳細を出力
for (const violation of result.violations) {
	console.log('URL:', violation.url);
	console.log('WCAG:', violation.wcagVersion, violation.scNumber);
	console.log('レベル:', violation.level);
	console.log('重要度:', violation.severity);
	console.log('対象ノード:', violation.targetNode.value);
	console.log('現状:', violation.asIs.value);
	console.log('あるべき姿:', violation.toBe.value);
	console.log('説明:', violation.explanation.value);
	console.log('---');
}

await browser.close();
```

### 例 5: 複数ページのチェック

```typescript
import { scenarioAxe } from '@d-zero/a11y-check-axe-scenario';
import puppeteer from 'puppeteer';

const urls = [
	'https://example.com',
	'https://example.com/about',
	'https://example.com/contact',
];

const browser = await puppeteer.launch();
const scenario = scenarioAxe({
	screenshot: true,
	cache: true,
	cacheDir: './cache/multi-page-check',
});

for (const url of urls) {
	const page = await browser.newPage();
	await page.goto(url);

	const result = await scenario.exec(page, 'desktop', (message) =>
		console.log(`[${url}] ${message}`),
	);

	console.log(`${url}: ${result.violations.length} 件の違反`);

	await page.close();
}

await browser.close();
```

## 返却される違反データの構造

`scenario.exec()` が返す `violations` 配列の各要素は、以下の構造を持ちます:

```typescript
{
	id: string; // 違反ID（空文字列）
	url: string; // チェック対象のURL
	tool: string; // 使用したツール名とバージョン（例: "axe-core (vX.Y.Z)"）
	timestamp: Date; // チェック実行日時
	component: string | null; // ランドマーク情報
	environment: string; // 環境名（サイズ名、例: "desktop", "mobile"）
	targetNode: {
		// 違反している要素
		value: string; // 要素のHTML
	}
	asIs: {
		// 現在の状態
		value: string; // axe-core からの説明
	}
	toBe: {
		// あるべき姿
		value: string; // 修正方法の説明
	}
	explanation: {
		// 詳細な説明
		value: string; // 追加の説明情報
	}
	wcagVersion: string | null; // WCAG バージョン（"WCAG2.0" または "WCAG2.1"）
	scNumber: string | null; // 達成基準番号（例: "1.1.1"）
	level: 'A' | 'AA' | 'AAA' | null; // 適合レベル
	severity: 'high' | 'medium' | 'low' | null; // 重要度
	screenshot: string | null; // Base64 エンコードされたスクリーンショット
}
```

## 対応する axe-core ルール

このパッケージは、axe-core の全ルールをサポートしています。主なルールには以下が含まれます:

- **ARIA 関連**: `aria-allowed-attr`, `aria-hidden-focus`, `aria-required-attr`, など
- **フォーム**: `label`, `button-name`, `input-button-name`, など
- **画像**: `image-alt`, `object-alt`, `svg-img-alt`, など
- **構造**: `heading-order`, `landmark-one-main`, `list`, など
- **色とコントラスト**: `color-contrast`, `color-contrast-enhanced`
- **キーボード操作**: `tabindex`, `accesskeys`, `bypass`
- **多言語**: `html-has-lang`, `html-lang-valid`, `valid-lang`

詳細なルールリストは `types.ts` の `AxeRuleId` 型を参照してください。

## 型のエクスポート

### `A11yCheckAxeOptions`

`scenarioAxe`関数のオプション型です。

### `Explanation`

違反の説明情報を表す型です。

```typescript
type Explanation = {
	main: string; // メインの説明テキスト
	help: string; // ヘルプテキスト
};
```

### `AxeRuleId`

axe-coreのルールIDのユニオン型です。サポートされるすべてのルールIDが定義されています。

## ライセンス

MIT

## 作者

D-ZERO
