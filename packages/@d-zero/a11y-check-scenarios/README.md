# @d-zero/a11y-check-scenarios

Webサイトのアクセシビリティをチェックするためのシナリオコレクション

## インストール

```bash
npm install @d-zero/a11y-check-scenarios puppeteer
```

または

```bash
yarn add @d-zero/a11y-check-scenarios puppeteer
```

## 概要

`@d-zero/a11y-check-scenarios` は、Webページのアクセシビリティを自動的にチェックするための定義済みシナリオを提供するパッケージです。Puppeteerを使用してブラウザを制御し、WCAG（Web Content Accessibility Guidelines）の達成基準に基づいた検証を実行します。

このパッケージには2つの主要なシナリオが含まれています:

- **scenario01**: WCAG達成基準に基づく視覚的検証（スクリーンショット生成）
- **scenario02**: ナビゲーション要素の抽出と分析

### 主な特徴

- WCAGの達成基準に基づいた自動チェック
- スクリーンショットベースの視覚的検証
- キャッシュ機能による効率的な再実行
- HTML形式のレポート生成
- TypeScript完全サポート

## scenario01の説明

scenario01は、WCAGの以下の達成基準をテストするシナリオです。各テストでスクリーンショットを撮影し、視覚的に検証できるHTML形式のレポートを生成します。

### テストされるWCAG達成基準

#### 1. SC 2.5.8 Target Size (Minimum) - ターゲットサイズ（最小）

**検証内容:**

- インタラクティブ要素（`a`、`button`、`input`、`select`、`textarea`、`label`、`summary`）のターゲットサイズが24px × 24px以上であるかをチェック
- 基準を満たさない要素を赤い半透明の矩形と円でマーキング

**視覚化:**

- 24px × 24px未満の要素: 赤い半透明の矩形と中心に赤い円（半径12px）で表示
- すべてのインタラクティブ要素: 赤い半透明の矩形で境界を表示

#### 2. SC 1.4.4 Text Resize - テキストのリサイズ

**検証内容:**

- テキストを200%に拡大した際にコンテンツや機能が損なわれないかをチェック
- キャプションと画像化された文字を除く、すべてのテキストを200%に拡大

**検証方法:**

- ルート要素の`font-size`を200%に設定してスクリーンショットを撮影

#### 3. SC 1.4.12 Text Spacing - テキストの間隔

**検証内容:**

- 以下のテキスト間隔が設定された際にコンテンツや機能が損なわれないかをチェック:
  - 行の高さ（行間）: フォントサイズの1.5倍以上
  - 段落の間隔: フォントサイズの2倍以上
  - 文字の間隔（字間）: フォントサイズの0.12倍以上
  - 単語の間隔: フォントサイズの0.16倍以上

**検証方法:**

- すべての要素に上記のスタイルを強制的に適用してスクリーンショットを撮影

### 出力形式

scenario01は各テストごとに以下の形式でHTMLレポートを生成します:

- ファイル名: `a11y-check-scenario01_[テスト名].html`
- 内容: 各ページ・各画面サイズごとのスクリーンショット一覧
- スタイル: 黒背景で画像を並べて表示

## scenario02の説明

scenario02は、Webページからナビゲーション要素を抽出するシナリオです。

### 検証内容

以下のセレクタにマッチする要素のouterHTMLを収集します:

- `header`: ヘッダー要素
- `nav`: ナビゲーション要素
- `footer`: フッター要素
- `[class*='nav' i]`: クラス名に"nav"を含む要素（大文字小文字を区別しない）

### 出力形式

各要素のHTMLコードを抽出し、分析用のデータとして保存します。

## 使用例

### 基本的な使用方法

```typescript
import { scenario01, scenario02 } from '@d-zero/a11y-check-scenarios';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();

// scenario01を実行
const scenario1 = scenario01();
await page.goto('https://example.com');
const result1 = await scenario1.exec(page, 'desktop', console.log);

// scenario02を実行
const scenario2 = scenario02();
await page.goto('https://example.com');
const result2 = await scenario2.exec(page, 'desktop', console.log);

await browser.close();
```

### オプション付きの使用方法

```typescript
import { scenario01, scenario02 } from '@d-zero/a11y-check-scenarios';

// キャッシュを無効化
const scenario1 = scenario01({ cache: false });

// カスタムキャッシュディレクトリを指定
const scenario2 = scenario02({ cacheDir: '/path/to/cache' });
```

### 分析結果の生成

```typescript
import { scenario01 } from '@d-zero/a11y-check-scenarios';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();
const scenario = scenario01();

// 複数のページをチェック
const urls = [
	'https://example.com',
	'https://example.com/about',
	'https://example.com/contact',
];

const allResults = [];

for (const url of urls) {
	await page.goto(url);
	const result = await scenario.exec(page, 'desktop', console.log);
	if (result.needAnalysis) {
		allResults.push(...result.needAnalysis);
	}
}

// HTML形式のレポートを生成
await scenario.analyze(allResults, console.log);

await browser.close();
```

### 複数の画面サイズでテスト

```typescript
import { scenario01 } from '@d-zero/a11y-check-scenarios';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();
const scenario = scenario01();

const allResults = [];

// デスクトップサイズ
await page.setViewport({ width: 1920, height: 1080 });
await page.goto('https://example.com');
const desktopResult = await scenario.exec(page, 'desktop', console.log);
if (desktopResult.needAnalysis) {
	allResults.push(...desktopResult.needAnalysis);
}

// タブレットサイズ
await page.setViewport({ width: 768, height: 1024 });
await page.goto('https://example.com');
const tabletResult = await scenario.exec(page, 'tablet', console.log);
if (tabletResult.needAnalysis) {
	allResults.push(...tabletResult.needAnalysis);
}

// モバイルサイズ
await page.setViewport({ width: 375, height: 667 });
await page.goto('https://example.com');
const mobileResult = await scenario.exec(page, 'mobile', console.log);
if (mobileResult.needAnalysis) {
	allResults.push(...mobileResult.needAnalysis);
}

// レポート生成
await scenario.analyze(allResults, console.log);

await browser.close();
```

## API

### scenario01(options?: ScenarioOptions)

WCAG達成基準に基づく視覚的検証シナリオを作成します。

**パラメータ:**

- `options.cache` (boolean, optional): キャッシュを使用するかどうか（デフォルト: true）
- `options.cacheDir` (string, optional): キャッシュディレクトリのパス

**戻り値:**

- Scenarioオブジェクト

### scenario02(options?: ScenarioOptions)

ナビゲーション要素を抽出するシナリオを作成します。

**パラメータ:**

- `options.cache` (boolean, optional): キャッシュを使用するかどうか（デフォルト: true）
- `options.cacheDir` (string, optional): キャッシュディレクトリのパス

**戻り値:**

- Scenarioオブジェクト

### Scenarioオブジェクトのメソッド

#### exec(page: Page, sizeName: string, logger: Function)

シナリオを実行します。

**パラメータ:**

- `page`: Puppeteerのページオブジェクト
- `sizeName`: 画面サイズの名前（例: 'desktop', 'mobile'）
- `logger`: ログ出力用の関数

**戻り値:**

- `needAnalysis`: 分析が必要なデータの配列

#### analyze(results: NeedAnalysis[], logger: Function)

収集したデータを分析し、レポートを生成します。

**パラメータ:**

- `results`: execメソッドで収集したデータの配列
- `logger`: ログ出力用の関数

## ライセンス

MIT

## 作者

D-ZERO
