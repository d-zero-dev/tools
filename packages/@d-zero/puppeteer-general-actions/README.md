# `@d-zero/puppeteer-general-actions`

Puppeteer操作のライフサイクルイベントをログするための汎用ヘルパーライブラリ。

## インストール

```bash
npm install @d-zero/puppeteer-general-actions
```

## 概要

このパッケージは、Puppeteerを使った処理のフェーズごとにログを出力するためのリスナーを作成する機能を提供します。デバイスサイズや処理フェーズに応じたカラーラベル付きログ出力が可能です。

## API

### `createListener<P>(listener: Loggers<P>): (log: (log: string) => void) => Listener<P>`

フェーズごとのログ出力関数を持つリスナーを作成します。

**型パラメータ:**

- `P`: 各フェーズのデータ型を定義するレコード型。各フェーズは`{ name: string }`を含む必要があります

**パラメータ:**

- `listener`: ログ出力関数を受け取り、各フェーズのハンドラーを返す関数

**戻り値:**

- ログ出力関数を受け取り、`Listener<P>`を返す関数

**使用例:**

```typescript
import { createListener } from '@d-zero/puppeteer-general-actions';

// フェーズの型定義
type Phases = {
	start: { name: string; url: string };
	complete: { name: string; duration: number };
	error: { name: string; message: string };
};

// リスナーの作成
const listener = createListener<Phases>((log) => ({
	start: (data) => {
		log(`開始: ${data.url}`);
	},
	complete: (data) => {
		log(`完了 (${data.duration}ms)`);
	},
	error: (data) => {
		log(`エラー: ${data.message}`);
	},
}));

// ログ出力関数を渡してリスナーを初期化
const listen = listener(console.log);

// フェーズごとにリスナーを呼び出す
listen('start', { name: 'desktop', url: 'https://example.com' });
// 出力: " desktop " 開始: https://example.com

listen('complete', { name: 'desktop', duration: 1500 });
// 出力: " desktop " 完了 (1500ms)

listen('error', { name: 'desktop', message: 'タイムアウト' });
// 出力: " desktop " エラー: タイムアウト
```

### 型定義

#### `Listener<P>`

```typescript
type Listener<P> = (phase: keyof P, data: P[keyof P]) => void;
```

フェーズ名とそのフェーズのデータを受け取るリスナー関数の型。

#### `Loggers<P>`

```typescript
type Loggers<P> = (log: (log: string) => void) => {
	[K in keyof P]?: (data: P[K]) => void;
};
```

ログ出力関数を受け取り、各フェーズのハンドラーオブジェクトを返す関数の型。

## 機能

### カラーラベル

各ログ出力には、データに含まれる`name`フィールドに基づいたマゼンタ背景のラベルが自動的に付与されます。これにより、複数のデバイスサイズやプロセスを並行して処理する際に、ログの視認性が向上します。

### フェーズのオプショナル性

リスナーの各フェーズハンドラーはオプショナルです。必要なフェーズのみを実装できます。

## 関連パッケージ

このパッケージは以下のパッケージで使用されています：

- [`@d-zero/puppeteer-page-scan`](../puppeteer-page-scan/README.md) - ページスキャン処理のログ出力
- [`@d-zero/puppeteer-screenshot`](../puppeteer-screenshot/README.md) - スクリーンショット撮影のログ出力

## ライセンス

MIT
