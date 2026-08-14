# `@d-zero/proc-talk`

Node.js の `child_process.fork` 上に双方向 IPC を構築するライブラリ。型安全なメソッド呼び出しとライフサイクル管理を提供する。

## Installation

```sh
yarn add @d-zero/proc-talk
```

## Usage

メインプロセス:

```ts
import { ProcTalk } from '@d-zero/proc-talk';

type WorkerAPI = {
	add: (a: number, b: number) => Promise<number>;
};

await using worker = new ProcTalk<WorkerAPI>({
	type: 'main',
	subModulePath: './worker.js',
});

const result = await worker.call('add', 10, 20);
// スコープ脱出時に子プロセスへ自動で :kill が送られ、exit まで待機する
```

子プロセス (`./worker.js`):

```ts
import { ProcTalk } from '@d-zero/proc-talk';

new ProcTalk({
	type: 'sub',
	handlers: {
		add: async (a, b) => a + b,
	},
});
```

シリアライズ仕様（関数は IPC 越境で `null` 化される制約）、エラー時のスタックトレース保持、`Symbol.asyncDispose` 時のクリーンアップ順序は `src/proc-talk.ts` と `src/serialize.ts` の JSDoc を参照。
