# `@d-zero/dealer`

コレクションを並列処理し、ログを順次出力する API。並列数制御・キャンセル・進捗ヘッダー対応。

## Installation

```sh
yarn add @d-zero/dealer
```

## Usage

```ts
import { deal } from '@d-zero/dealer';

await deal(
	items,
	(item, update, index, setLineHeader, push) => {
		return async () => {
			update(`item(${index}): processing`);
			await item.start();
		};
	},
	{ limit: 30 },
);
```

`setup` コールバックは「初期化」を同期で行い、「実行関数」を返す形（並列度を超えた分はキューに入る）。`push` / `unshift` で実行中に新規アイテムを動的に追加可能。

### キャンセル（`AbortSignal`）

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 30_000);

await deal(items, setup, { limit: 10, signal: controller.signal });
```

abort 時の挙動: **新規ワーカー起動を停止、実行中ワーカーは完了まで待機、`push`/`unshift` は無視**。詳細は `src/deal.ts` / `src/dealer.ts` の JSDoc。

## 重要な制約

- **`interval` 遅延はアイテム開始の「直後・最初の出力前」**に実行される（順序に注意）
- **`unshift` は既存キューの先頭に割り込む**（優先度の高い動的追加用、push との順序を理解する必要あり）
- **`verbose` モードでは `close()` でリスナーを明示解放**する必要あり（leak 防止）

これらの背景と実装は `src/deal.ts` / `src/dealer.ts` / `src/lanes.ts` の JSDoc を参照。
