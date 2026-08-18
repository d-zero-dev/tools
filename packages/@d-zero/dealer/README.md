# `@d-zero/dealer`

コレクションを並列処理し、ログを順次出力する API（`deal`。並列数制御・キャンセル・進捗ヘッダー対応）と、
型安全な逐次パイプラインを構築するとタスクリストTUIが自動生成される API（`TaskList`）を提供する。

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

## Sequential Pipeline（`TaskList`）

```ts
import { TaskList } from '@d-zero/dealer';

const id = await TaskList.pipe('fetch', async () => fetchUser(userId))
	.pipe('normalize', (user) => normalizeUser(user))
	.pipe('save', async (user, ctx) => {
		ctx.progress('writing to db...');
		await db.save(user);
		return user.id;
	})
	.run();
```

`.pipe()` を連結するたびに前段の戻り値を受け取り型変換する新しいステップが追加され、`run()` を呼ぶと全ステップを最初から `[ ] タスク名: 進捗メッセージ` の形式で表示し、先頭から逐次実行しながら状態（pending/running/done/error）を更新する。あるステップが失敗すると即座に停止し、`TaskListStepError` で reject する（後続ステップは実行されない）。

- 各パイプラインインスタンスの `run()` は1回のみ呼び出せる（再実行したい場合は `TaskList.pipe()` から新しく構築する）
- `ctx.insertNext()` で、実行中に同じ型のステップを直後へ動的に割り込み挿入できる
- 詳細は `src/task-list-pipeline.ts` / `src/types.ts` の JSDoc を参照

## 重要な制約

- **`interval` 遅延はアイテム開始の「直後・最初の出力前」**に実行される（順序に注意）
- **`unshift` は既存キューの先頭に割り込む**（優先度の高い動的追加用、push との順序を理解する必要あり）
- **`Lanes` / `Display` を直接使う場合は `using` 宣言（`Symbol.dispose`）で自動解放**する（leak 防止）。スコープと解放タイミングが一致しない場合のみ `close()` を直接呼ぶ（`close()` は deprecated）

これらの背景と実装は `src/deal.ts` / `src/dealer.ts` / `src/lanes.ts` の JSDoc を参照。
