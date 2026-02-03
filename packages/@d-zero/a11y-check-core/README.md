# @d-zero/a11y-check-core

Webサイトのアクセシビリティをチェックするためのコアモジュールです。Puppeteerを使用してページをスキャンし、WCAG準拠のアクセシビリティ違反を検出します。

## インストール

```bash
npm install @d-zero/a11y-check-core
```

または

```bash
yarn add @d-zero/a11y-check-core
```

## 概要

`@d-zero/a11y-check-core` は、Webページのアクセシビリティをプログラムで検証するための柔軟なフレームワークを提供します。シナリオベースのアーキテクチャを採用しており、カスタムチェックを簡単に作成・拡張できます。

### 主な機能

- **シナリオベースのチェック**: カスタムアクセシビリティチェックを定義可能
- **複数デバイスサイズ対応**: デスクトップとモバイルビューポートでのテスト
- **色のコントラスト比チェック**: WCAG AA/AAAレベルの自動判定
- **並列実行**: 複数のURLを効率的にチェック
- **キャッシング**: チェック結果のキャッシュによる高速化
- **詳細な結果分類**: Passed（合格）、Violation（違反）、NeedAnalysis（要分析）の3種類

## 主要なAPI

### `scenarioRunner`

複数のURLに対してアクセシビリティチェックを実行するメイン関数です。

```typescript
async function scenarioRunner<O>(
	urlList: readonly (string | { id: string | null; url: string })[],
	scenarios: readonly Scenario[],
	options?: O & CoreOptions & ScenarioRunnerOptions & DealOptions,
): Promise<Result>;
```

#### パラメータ

- `urlList`: チェック対象のURL配列。文字列または `{ id, url }` オブジェクトで指定
- `scenarios`: 実行するシナリオの配列
- `options`: オプション設定
  - `screenshot`: スクリーンショットを撮影するかどうか（boolean）
  - `cache`: キャッシュを使用するかどうか（boolean）
  - `cacheDir`: キャッシュディレクトリのパス（string、デフォルト: `.a11y-check-core`）
  - `locale`: ロケール設定（string）
  - `hooks`: ページスキャン時のフック関数（PageHook[]）
  - その他の `DealOptions`（並列実行の設定など）

#### 戻り値

```typescript
{
  needAnalysis: readonly NeedAnalysis[];
  passed: readonly Passed[];
  violations: readonly Violation[];
}
```

#### 使用例

```typescript
import { scenarioRunner, createScenario } from '@d-zero/a11y-check-core';

const myScenario = createScenario(() => ({
	modulePath: '/path/to/scenario.js',
	moduleParams: '{}',
	id: 'my-scenario',
	exec: async (page, sizeName, log) => {
		log('Checking accessibility...');

		const violations = [];
		// カスタムチェックロジック

		return { violations };
	},
}));

const results = await scenarioRunner(['https://example.com'], [myScenario()], {
	cache: true,
	cacheDir: '.cache',
});

console.log(`Violations found: ${results.violations.length}`);
```

### `createScenario`

型安全なシナリオを作成するためのヘルパー関数です。

```typescript
function createScenario<O>(creator: ScenarioCreator<O>): ScenarioCreator<O>;
```

#### パラメータ

- `creator`: シナリオクリエーター関数
  - `options`: シナリオのオプション（任意の型）
  - 戻り値: `Scenario` オブジェクト

#### 使用例

```typescript
import { createScenario } from '@d-zero/a11y-check-core';
import type { Page } from 'puppeteer';

type MyScenarioOptions = {
	checkImages: boolean;
	checkForms: boolean;
};

const myScenario = createScenario<MyScenarioOptions>((options) => ({
	modulePath: import.meta.filename,
	moduleParams: JSON.stringify(options ?? {}),
	id: 'my-custom-scenario',

	exec: async (page: Page, sizeName: string, log: (msg: string) => void) => {
		log('Starting custom accessibility check');

		const violations = [];

		if (options?.checkImages) {
			// 画像のaltテキストチェック
			const imagesWithoutAlt = await page.$$eval('img:not([alt])', (imgs) =>
				imgs.map((img) => ({ src: img.src })),
			);

			for (const img of imagesWithoutAlt) {
				violations.push({
					id: 'img-alt-missing',
					url: page.url(),
					tool: 'my-scenario',
					timestamp: new Date(),
					component: null,
					environment: sizeName,
					targetNode: { value: `<img src="${img.src}">` },
					asIs: { value: 'alt属性が存在しない' },
					toBe: { value: '画像には代替テキスト（alt属性）が必要' },
					explanation: { value: 'スクリーンリーダーで画像の内容が伝わらない' },
					wcagVersion: 'WCAG 2.1',
					scNumber: '1.1.1',
					level: 'A',
					severity: 'high',
					screenshot: null,
				});
			}
		}

		if (options?.checkForms) {
			// フォームラベルのチェック
			// ...
		}

		return { violations };
	},

	analyze: async (needAnalysisResults, log) => {
		// 収集したデータの分析処理（オプション）
		log('Analyzing collected data...');

		const violations = [];
		// 分析ロジック

		return { violations };
	},
}));

// 使用
const scenario = myScenario({
	checkImages: true,
	checkForms: true,
});
```

### `colorContrastCheck`

要素のスタイルから色のコントラスト比をチェックする関数です。

```typescript
function colorContrastCheck(style: Style): ColorContrastError | ColorContrast;
```

#### パラメータ

- `style`: スタイルオブジェクト
  - `color`: 前景色（文字色）
  - `backgroundColor`: 背景色
  - `backgroundImage`: 背景画像
  - `closestBackgroundColor`: 最も近い親要素の背景色
  - `closestBackgroundImage`: 最も近い親要素の背景画像

#### 戻り値

成功時は `ColorContrast` オブジェクト、エラー時は `ColorContrastError` 列挙値を返します。

**ColorContrast オブジェクト:**

```typescript
{
	foreground: Color; // 前景色の詳細
	background: Color; // 背景色の詳細
	ratio: number; // コントラスト比（例: 4.52）
	ratioText: `${number}:1`; // コントラスト比のテキスト表現（例: "4.52:1"）
	AA: boolean; // WCAG AAレベルに合格するか
	AAA: boolean; // WCAG AAAレベルに合格するか
}
```

**ColorContrastError 列挙値:**

- `DOES_NOT_DETERMINE_FOREGROUND`: 前景色を判定できない
- `DOES_NOT_DETERMINE_BACKGROUND`: 背景色を判定できない
- `FOREGROUND_COLOR_HAS_ALPHA`: 前景色に透明度がある
- `BACKGROUND_COLOR_HAS_ALPHA`: 背景色に透明度がある

#### 使用例

```typescript
import { colorContrastCheck, ColorContrastError } from '@d-zero/a11y-check-core';

const style = await page.evaluate((selector) => {
	const element = document.querySelector(selector);
	const computed = window.getComputedStyle(element);

	let closestBackgroundColor = null;
	let parent = element.parentElement;
	while (parent) {
		const bg = window.getComputedStyle(parent).backgroundColor;
		if (bg && bg !== 'rgba(0, 0, 0, 0)') {
			closestBackgroundColor = bg;
			break;
		}
		parent = parent.parentElement;
	}

	return {
		color: computed.color,
		backgroundColor: computed.backgroundColor,
		backgroundImage: computed.backgroundImage,
		closestBackgroundColor,
		closestBackgroundImage: null,
	};
}, 'button');

const result = colorContrastCheck(style);

if (typeof result === 'number') {
	// エラー処理
	switch (result) {
		case ColorContrastError.DOES_NOT_DETERMINE_FOREGROUND:
			console.error('前景色を判定できません');
			break;
		case ColorContrastError.DOES_NOT_DETERMINE_BACKGROUND:
			console.error('背景色を判定できません');
			break;
		case ColorContrastError.FOREGROUND_COLOR_HAS_ALPHA:
			console.error('前景色に透明度があります');
			break;
		case ColorContrastError.BACKGROUND_COLOR_HAS_ALPHA:
			console.error('背景色に透明度があります');
			break;
	}
} else {
	// 成功
	console.log(`コントラスト比: ${result.ratioText}`);
	console.log(`WCAG AA: ${result.AA ? '合格' : '不合格'}`);
	console.log(`WCAG AAA: ${result.AAA ? '合格' : '不合格'}`);
}
```

### `colorFnToHex`

CSS color関数（`rgb()`、`rgba()`）を16進数カラーコードに変換する関数です。

```typescript
function colorFnToHex(colorFn: string | null): Color | null;
```

#### パラメータ

- `colorFn`: CSS color関数の文字列（例: `"rgb(255, 0, 0)"` または `"rgba(255, 0, 0, 0.5)"`）

#### 戻り値

```typescript
{
	r: number; // 赤成分 (0-255)
	g: number; // 緑成分 (0-255)
	b: number; // 青成分 (0-255)
	a: number; // アルファ値 (0-1)
	hex: string; // 16進数表現 (例: "#FF0000")
	hexA: string; // アルファを含む16進数表現 (例: "#FF000080")
}
```

完全に透明な色（`a = 0`）の場合は `null` を返します。

#### 使用例

```typescript
import { colorFnToHex } from '@d-zero/a11y-check-core';

const color1 = colorFnToHex('rgb(255, 0, 0)');
console.log(color1);
// { r: 255, g: 0, b: 0, a: 1, hex: '#FF0000', hexA: '#FF0000FF' }

const color2 = colorFnToHex('rgba(128, 128, 128, 0.5)');
console.log(color2);
// { r: 128, g: 128, b: 128, a: 0.5, hex: '#808080', hexA: '#80808080' }

const transparent = colorFnToHex('rgba(0, 0, 0, 0)');
console.log(transparent);
// null
```

### `scNumberComparator`

WCAG達成基準番号（SC番号）をソートするための比較関数です。

```typescript
function scNumberComparator(a: string | null, b: string | null): number;
```

#### パラメータ

- `a`, `b`: WCAG SC番号（例: `"1.1.1"`, `"2.4.7"`）または `null`

#### 戻り値

- `< 0`: `a` が `b` より前
- `0`: `a` と `b` が同じ
- `> 0`: `a` が `b` より後

`null` は常に最後になります。

#### 使用例

```typescript
import { scNumberComparator } from '@d-zero/a11y-check-core';

const violations = [
	{ scNumber: '2.4.7' },
	{ scNumber: '1.1.1' },
	{ scNumber: '1.3.1' },
	{ scNumber: null },
	{ scNumber: '2.4.1' },
];

violations.sort((a, b) => scNumberComparator(a.scNumber, b.scNumber));

console.log(violations.map((v) => v.scNumber));
// ['1.1.1', '1.3.1', '2.4.1', '2.4.7', null]
```

### `importScenarios`

シナリオモジュールを動的にインポートする関数です。

```typescript
async function importScenarios(scenarios: readonly Scenario[]): Promise<Scenario[]>;
```

#### パラメータ

- `scenarios`: シナリオオブジェクトの配列

#### 戻り値

インポートされたシナリオの配列（Promise）

通常はフレームワーク内部で使用されますが、カスタム実行環境を構築する場合に利用できます。

## 型定義

### `Scenario`

シナリオオブジェクトの型定義です。

```typescript
type Scenario = {
	readonly modulePath: string; // シナリオモジュールのファイルパス
	readonly moduleParams: string; // シナリオのパラメータ（JSON文字列）
	readonly id: string; // シナリオの一意なID
	readonly exec: ScenarioExecutor; // 実行関数
	readonly analyze?: ScenarioAnalyzer; // 分析関数（オプション）
};
```

### `ScenarioExecutor`

シナリオの実行関数の型定義です。

```typescript
type ScenarioExecutor = (
	page: Page, // Puppeteerのページオブジェクト
	sizeName: string, // デバイスサイズ名（"desktop" または "mobile"）
	log: (log: string) => void, // ログ出力関数
) => Promise<Partial<Result>>;
```

各シナリオは、ページをチェックして `Result` の一部を返します。

### `ScenarioAnalyzer`

収集したデータを分析する関数の型定義です。

```typescript
type ScenarioAnalyzer = (
	results: NeedAnalysis[], // 要分析データの配列
	log: (log: string) => void, // ログ出力関数
) => Promise<void | Partial<Result>> | void | Partial<Result>;
```

`NeedAnalysis` として収集されたデータをまとめて分析し、最終的な判定を下すことができます。

### `Result`

チェック結果を表す型です。

```typescript
type Result = {
	readonly needAnalysis: readonly NeedAnalysis[]; // 要分析データ
	readonly passed: readonly Passed[]; // 合格項目
	readonly violations: readonly Violation[]; // 違反項目
};
```

### `Passed`（合格）

アクセシビリティチェックに合格した項目を表します。

```typescript
type Passed = {
	readonly id: string; // チェック項目のID
	readonly url: string; // チェック対象のURL
	readonly tool: string | null; // 使用したツール名
	readonly timestamp: Date; // チェック実行日時
	readonly component: string | null; // コンポーネント名（任意）
	readonly environment: string; // 実行環境（デバイスサイズなど）
};
```

#### 使用例

```typescript
const passed: Passed = {
	id: 'color-contrast-check',
	url: 'https://example.com',
	tool: 'color-contrast-checker',
	timestamp: new Date(),
	component: 'Button',
	environment: 'desktop',
};
```

### `Violation`（違反）

アクセシビリティ違反を表します。

```typescript
type Violation = {
	readonly id: string; // 違反のID
	readonly url: string; // 違反が見つかったURL
	readonly tool: string | null; // 使用したツール名
	readonly timestamp: Date; // 検出日時
	readonly component: string | null; // コンポーネント名
	readonly environment: string; // 実行環境

	// 違反の詳細
	readonly targetNode: Details; // 対象要素
	readonly asIs: Details; // 現状
	readonly toBe: Details; // あるべき姿
	readonly explanation: Details; // 説明

	// WCAG情報
	readonly wcagVersion: string | null; // WCAGバージョン（例: "WCAG 2.1"）
	readonly scNumber: string | null; // 達成基準番号（例: "1.4.3"）
	readonly level: 'A' | 'AA' | 'AAA' | null; // 適合レベル
	readonly severity: 'high' | 'medium' | 'low' | null; // 深刻度

	readonly screenshot: string | null; // スクリーンショットのパス
};

type Details = {
	readonly value: string; // 値
	readonly note?: string; // 補足説明（任意）
};
```

#### 使用例

```typescript
const violation: Violation = {
	id: 'low-contrast-text',
	url: 'https://example.com/page',
	tool: 'color-contrast-checker',
	timestamp: new Date(),
	component: 'MainButton',
	environment: 'mobile',

	targetNode: {
		value: '<button class="primary">送信</button>',
		note: 'ページ下部の送信ボタン',
	},

	asIs: {
		value: 'コントラスト比 2.8:1',
		note: '前景色 #767676、背景色 #FFFFFF',
	},

	toBe: {
		value: 'コントラスト比 4.5:1 以上',
		note: 'WCAG AA レベルでは通常テキストに4.5:1以上が必要',
	},

	explanation: {
		value:
			'テキストと背景のコントラストが不十分なため、ロービジョンのユーザーが読みにくい',
		note: 'より濃い色を使用するか、背景色を変更してください',
	},

	wcagVersion: 'WCAG 2.1',
	scNumber: '1.4.3',
	level: 'AA',
	severity: 'high',
	screenshot: '/screenshots/page-violation-001.png',
};
```

### `NeedAnalysis`（要分析）

自動判定できず、人間による分析が必要なデータを表します。

```typescript
type NeedAnalysis = {
	readonly id: string; // データのID
	readonly url: string; // データが収集されたURL
	readonly tool: string | null; // 使用したツール名
	readonly timestamp: Date; // 収集日時
	readonly component: string | null; // コンポーネント名
	readonly environment: string; // 実行環境

	readonly scenarioId: string; // 収集したシナリオのID
	readonly subKey?: string; // サブキー（同じシナリオで複数のデータ種別を扱う場合）
	readonly data: string; // 収集したデータ（JSON文字列など）
};
```

`NeedAnalysis` は、自動的に判定できない情報（例: 画像の代替テキストが適切か、リンクテキストが文脈に依存するかなど）を収集し、後で `ScenarioAnalyzer` や外部ツールで分析するために使用します。

#### 使用例

```typescript
// シナリオ実行時にデータを収集
const exec: ScenarioExecutor = async (page, sizeName, log) => {
	const needAnalysis: NeedAnalysis[] = [];

	const images = await page.$$eval('img[alt]', (imgs) =>
		imgs.map((img) => ({
			src: img.getAttribute('src'),
			alt: img.getAttribute('alt'),
		})),
	);

	for (const img of images) {
		needAnalysis.push({
			id: `img-alt-analysis-${img.src}`,
			url: page.url(),
			tool: 'alt-text-analyzer',
			timestamp: new Date(),
			component: null,
			environment: sizeName,
			scenarioId: 'alt-text-quality',
			data: JSON.stringify(img),
		});
	}

	return { needAnalysis };
};

// 分析関数でまとめて判定
const analyze: ScenarioAnalyzer = async (results, log) => {
	const violations: Violation[] = [];

	for (const result of results) {
		const { src, alt } = JSON.parse(result.data);

		// AIや辞書を使った代替テキストの品質チェック
		if (alt.length < 3 || alt === 'image' || alt === 'photo') {
			violations.push({
				id: `insufficient-alt-${src}`,
				url: result.url,
				tool: result.tool,
				timestamp: result.timestamp,
				component: result.component,
				environment: result.environment,
				targetNode: { value: `<img src="${src}" alt="${alt}">` },
				asIs: { value: `代替テキスト: "${alt}"` },
				toBe: { value: '画像の内容を具体的に説明する代替テキスト' },
				explanation: { value: '代替テキストが不十分または汎用的すぎます' },
				wcagVersion: 'WCAG 2.1',
				scNumber: '1.1.1',
				level: 'A',
				severity: 'high',
				screenshot: null,
			});
		}
	}

	return { violations };
};
```

### その他の型

#### `Style`

要素のスタイル情報を表します。

```typescript
type Style = {
	readonly color: string; // 前景色
	readonly backgroundColor: string; // 背景色
	readonly backgroundImage: string; // 背景画像
	readonly closestBackgroundColor: string | null; // 最も近い親要素の背景色
	readonly closestBackgroundImage: string | null; // 最も近い親要素の背景画像
};
```

#### `Color`

色の詳細情報を表します。

```typescript
type Color = {
	readonly r: number; // 赤成分 (0-255)
	readonly g: number; // 緑成分 (0-255)
	readonly b: number; // 青成分 (0-255)
	readonly a: number; // アルファ値 (0-1)
	readonly hex: string; // 16進数表現（例: "#FF0000"）
	readonly hexA: string; // アルファを含む16進数表現（例: "#FF0000FF"）
};
```

#### `ColorContrast`

色のコントラスト比の情報を表します。

```typescript
type ColorContrast = {
	readonly foreground: Color; // 前景色
	readonly background: Color; // 背景色
	readonly ratio: number; // コントラスト比（例: 4.52）
	readonly ratioText: `${number}:1`; // コントラスト比のテキスト（例: "4.52:1"）
	readonly AA: boolean; // WCAG AAレベルに合格するか
	readonly AAA: boolean; // WCAG AAAレベルに合格するか
};
```

#### `CoreOptions`

コアオプションの型定義です。

```typescript
type CoreOptions = {
	readonly screenshot?: boolean; // スクリーンショットを撮影するか
	readonly cache?: boolean; // キャッシュを使用するか
	readonly cacheDir?: string; // キャッシュディレクトリ
};
```

#### `ScenarioRunnerOptions`

シナリオランナーのオプションの型定義です。

```typescript
type ScenarioRunnerOptions = DealOptions & {
	readonly locale?: string; // ロケール設定
	readonly hooks?: readonly PageHook[]; // ページスキャン時のフック
};
```

## 完全な使用例

以下は、カスタムシナリオを作成してアクセシビリティチェックを実行する完全な例です。

```typescript
import {
	scenarioRunner,
	createScenario,
	colorContrastCheck,
	ColorContrastError,
} from '@d-zero/a11y-check-core';
import type {
	ScenarioExecutor,
	ScenarioAnalyzer,
	Violation,
	NeedAnalysis,
} from '@d-zero/a11y-check-core';
import type { Page } from 'puppeteer';

// カスタムシナリオのオプション型
type MyScenarioOptions = {
	checkContrast: boolean;
	checkHeadings: boolean;
};

// カスタムシナリオの作成
const myAccessibilityScenario = createScenario<MyScenarioOptions>((options) => ({
	modulePath: import.meta.filename,
	moduleParams: JSON.stringify(options ?? {}),
	id: 'my-a11y-scenario',

	// 実行関数: ページをチェックしてデータを収集
	exec: async (page: Page, sizeName: string, log: (msg: string) => void) => {
		const violations: Violation[] = [];
		const needAnalysis: NeedAnalysis[] = [];

		log('アクセシビリティチェックを開始');

		// 1. 色のコントラストチェック
		if (options?.checkContrast) {
			log('色のコントラスト比をチェック中...');

			const textElements = await page.$$('p, span, a, button, h1, h2, h3, h4, h5, h6');

			for (const element of textElements) {
				const style = await page.evaluate((el) => {
					const computed = window.getComputedStyle(el);
					let closestBg = null;
					let parent = el.parentElement;

					while (parent) {
						const bg = window.getComputedStyle(parent).backgroundColor;
						if (bg && bg !== 'rgba(0, 0, 0, 0)') {
							closestBg = bg;
							break;
						}
						parent = parent.parentElement;
					}

					return {
						color: computed.color,
						backgroundColor: computed.backgroundColor,
						backgroundImage: computed.backgroundImage,
						closestBackgroundColor: closestBg,
						closestBackgroundImage: null,
					};
				}, element);

				const contrastResult = colorContrastCheck(style);

				if (typeof contrastResult !== 'number' && !contrastResult.AA) {
					const html = await page.evaluate((el) => el.outerHTML, element);

					violations.push({
						id: `low-contrast-${Date.now()}`,
						url: page.url(),
						tool: 'color-contrast-checker',
						timestamp: new Date(),
						component: null,
						environment: sizeName,
						targetNode: { value: html },
						asIs: {
							value: `コントラスト比 ${contrastResult.ratioText}`,
							note: `前景色: ${contrastResult.foreground.hex}, 背景色: ${contrastResult.background.hex}`,
						},
						toBe: {
							value: 'コントラスト比 4.5:1 以上',
							note: 'WCAG AAレベル準拠',
						},
						explanation: {
							value: 'テキストと背景のコントラストが不十分です',
						},
						wcagVersion: 'WCAG 2.1',
						scNumber: '1.4.3',
						level: 'AA',
						severity: 'high',
						screenshot: null,
					});
				}
			}
		}

		// 2. 見出し構造のチェック
		if (options?.checkHeadings) {
			log('見出し構造をチェック中...');

			const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', (elements) =>
				elements.map((el) => ({
					tag: el.tagName.toLowerCase(),
					text: el.textContent?.trim() ?? '',
					html: el.outerHTML,
				})),
			);

			// 見出しレベルのスキップをチェック
			for (let i = 1; i < headings.length; i++) {
				const prevLevel = parseInt(headings[i - 1].tag.slice(1));
				const currLevel = parseInt(headings[i].tag.slice(1));

				if (currLevel - prevLevel > 1) {
					violations.push({
						id: `heading-skip-${i}`,
						url: page.url(),
						tool: 'heading-structure-checker',
						timestamp: new Date(),
						component: null,
						environment: sizeName,
						targetNode: { value: headings[i].html },
						asIs: {
							value: `${headings[i - 1].tag} の次に ${headings[i].tag} が使用されています`,
						},
						toBe: {
							value: '見出しレベルは順番に使用する必要があります',
						},
						explanation: {
							value:
								'見出しレベルをスキップすると、スクリーンリーダーユーザーが文書構造を理解しにくくなります',
						},
						wcagVersion: 'WCAG 2.1',
						scNumber: '1.3.1',
						level: 'A',
						severity: 'medium',
						screenshot: null,
					});
				}
			}
		}

		log(`チェック完了: ${violations.length}件の違反を検出`);

		return { violations, needAnalysis };
	},

	// 分析関数（オプション）: 収集したデータを後で分析
	analyze: async (results: NeedAnalysis[], log: (msg: string) => void) => {
		log(`${results.length}件のデータを分析中...`);

		// ここで収集したデータをまとめて分析
		const violations: Violation[] = [];

		// 例: 複数ページのデータを比較して判定するなど

		return { violations };
	},
}));

// メイン処理
async function main() {
	const urls = [
		'https://example.com',
		'https://example.com/about',
		'https://example.com/contact',
	];

	const scenario = myAccessibilityScenario({
		checkContrast: true,
		checkHeadings: true,
	});

	const results = await scenarioRunner(urls, [scenario], {
		cache: true,
		cacheDir: '.a11y-cache',
		locale: 'ja-JP',
	});

	console.log('\n=== アクセシビリティチェック結果 ===');
	console.log(`合格: ${results.passed.length}件`);
	console.log(`違反: ${results.violations.length}件`);
	console.log(`要分析: ${results.needAnalysis.length}件`);

	// 違反の詳細を出力
	if (results.violations.length > 0) {
		console.log('\n=== 違反の詳細 ===');
		for (const violation of results.violations) {
			console.log(`\n[${violation.severity}] ${violation.id}`);
			console.log(`URL: ${violation.url}`);
			console.log(
				`WCAG: ${violation.wcagVersion} ${violation.scNumber} (レベル ${violation.level})`,
			);
			console.log(`現状: ${violation.asIs.value}`);
			console.log(`改善: ${violation.toBe.value}`);
			console.log(`説明: ${violation.explanation.value}`);
		}
	}
}

main().catch(console.error);
```

## ライセンス

MIT

## 作者

D-ZERO
