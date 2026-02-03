# `@d-zero/proc-talk`

Node.js の子プロセス管理とプロセス間通信 (IPC) を効率化するライブラリです。メインプロセスと子プロセス間の双方向通信を簡単なインターフェースで実現します。`ProcTalk` を使用することで、子プロセスのフォーク、非同期タスクの送信、プロセス間のメッセージやデータのやり取りを複雑な設定なしで行えます。

## インストール

```bash
npm install @d-zero/proc-talk
```

## `ProcTalk` クラスの概要

`ProcTalk` クラスは、Node.js アプリケーション内での子プロセス管理と通信を簡素化するために設計されています。メインプロセスから子プロセスをフォークして管理し、非同期タスクを送信し、プロセス間でメッセージをやり取りできます。`ProcTalk` は、タスクを子プロセスにオフロードすることでパフォーマンスを向上させたいアプリケーションに最適です。

### 主な機能

- **子プロセスのフォークと管理**: Node.js の `child_process.fork` を使用して、子プロセスを簡単に作成・管理
- **非同期タスクハンドリング**: Promise を使用してメインプロセスから子プロセスへタスクを送信し、結果を非同期に受信。シームレスな並列処理を実現
- **双方向メッセージパッシング**: 複雑なデータ構造のシリアライズ・デシリアライズをサポートし、プロセス間のメッセージパッシングを実現
- **プロセスライフサイクル管理**: プロセスの初期化とクリーンアップを管理し、プロセスライフサイクル全体を通じて信頼性の高い通信を保証

### ユースケース

- **バックグラウンド処理のオフロード**: リソース集約型のタスクを子プロセスに委譲し、メインプロセスの負荷を軽減
- **レスポンシブ性の向上**: 特定のタスクを子プロセスで実行することで、メインプロセスのブロッキングを防ぎ、アプリケーションのレスポンシブ性を維持
- **シンプルな子プロセス統合**: 子プロセスとのタスクやデータ交換を簡単に管理し、メインプロセスが効果的にワークロードを分散

## API リファレンス

### ProcTalk クラス

```typescript
class ProcTalk<T, O = void>
```

#### 型パラメータ

- `T`: プロセス間で通信する関数の型定義を持つオブジェクト型
- `O`: 子プロセスに渡すオプションの型（デフォルト: `void`）

#### コンストラクタ

```typescript
new ProcTalk<T, O>(config: ProcTalkConfig<T, O>)
```

##### パラメータ

`config` は以下の2つの形式のいずれかを取ります：

**メインプロセス用の設定:**

```typescript
{
  type: 'main';
  subModulePath: string;  // 子プロセスとして実行するモジュールのパス（絶対パスまたは相対パス）
  options?: O;            // 子プロセスに渡すオプション（任意）
}
```

**子プロセス用の設定:**

```typescript
{
  type: 'child';
  title?: string;         // プロセスタイトル（process.title に設定される、デフォルト: '@d-zero/proc-talk:child-process'）
  process: (             // 子プロセスで実行される関数
    this: ProcTalk<T, O>,
    options?: O
  ) => ChildProcCleanup | Promise<ChildProcCleanup> | void;
}
```

`process` 関数は、子プロセスの初期化時に実行され、オプションでクリーンアップ関数を返すことができます。クリーンアップ関数は、子プロセスが終了する際に自動的に呼び出されます。

**ChildProcCleanup 型:**

```typescript
type ChildProcCleanup = () => void | Promise<void>;
```

##### 例

**メインプロセスでの使用:**

```typescript
import { ProcTalk } from '@d-zero/proc-talk';

type WorkerAPI = {
	processData: (data: string) => Promise<number>;
	calculate: (a: number, b: number) => number;
};

// 子プロセスをフォーク
const worker = new ProcTalk<WorkerAPI>({
	type: 'main',
	subModulePath: './worker.js',
	options: { maxConcurrency: 4 },
});

// 初期化完了を待つ
await worker.initialized();
```

**子プロセスでの使用:**

```typescript
// worker.ts
import { ProcTalk } from '@d-zero/proc-talk';

type WorkerAPI = {
	processData: (data: string) => Promise<number>;
	calculate: (a: number, b: number) => number;
};

type WorkerOptions = {
	maxConcurrency?: number;
};

const worker = new ProcTalk<WorkerAPI, WorkerOptions>({
	type: 'child',
	title: 'my-worker',
	process: async (options) => {
		// 初期化処理
		console.log('Worker started with options:', options);

		// API をバインド
		worker.bind('processData', async (data: string) => {
			// データ処理ロジック
			return data.length;
		});

		worker.bind('calculate', (a: number, b: number) => {
			return a + b;
		});

		// クリーンアップ関数を返す
		return async () => {
			console.log('Cleaning up worker resources...');
			// リソースのクリーンアップ処理
		};
	},
});
```

#### メソッド

##### `bind<P extends keyof T>(type: P, listener: T[P]): void`

子プロセス側で、特定の関数名に対してリスナー関数をバインドします。メインプロセスから `call()` でこの関数名が呼び出されると、バインドされたリスナーが実行されます。

###### パラメータ

- `type`: 関数名（`T` 型のキー）
- `listener`: 実行される関数。`T[type]` の型シグネチャに一致する必要があります

###### 戻り値

なし（`void`）

###### 例

```typescript
// 子プロセス側
type API = {
	add: (a: number, b: number) => number;
	greet: (name: string) => Promise<string>;
};

const proc = new ProcTalk<API>({
	type: 'child',
	process() {
		// 同期関数のバインド
		proc.bind('add', (a, b) => {
			return a + b;
		});

		// 非同期関数のバインド
		proc.bind('greet', async (name) => {
			await new Promise((resolve) => setTimeout(resolve, 100));
			return `Hello, ${name}!`;
		});
	},
});
```

##### `call<P extends keyof T>(type: P, ...payload: Parameters<T[P]>): Promise<ReturnType<T[P]>>`

メインプロセス側から子プロセスのバインドされた関数を呼び出します。非同期で結果を Promise として受け取ります。

###### パラメータ

- `type`: 呼び出す関数名（`T` 型のキー）
- `...payload`: 関数に渡す引数。`T[type]` のパラメータ型に一致する必要があります

###### 戻り値

`Promise<ReturnType<T[P]>>`: 子プロセスで実行された関数の戻り値を解決する Promise

###### エラーハンドリング

子プロセス内で発生したエラーは、メインプロセス側でキャッチされ、Promise が reject されます。エラーメッセージとスタックトレースは保持されます。

###### 例

```typescript
// メインプロセス側
type API = {
	add: (a: number, b: number) => number;
	greet: (name: string) => Promise<string>;
	processFile: (path: string) => Promise<{ size: number; lines: number }>;
};

const worker = new ProcTalk<API>({
	type: 'main',
	subModulePath: './worker.js',
});

await worker.initialized();

// 同期関数の呼び出し
const sum = await worker.call('add', 10, 20);
console.log(sum); // 30

// 非同期関数の呼び出し
const greeting = await worker.call('greet', 'Alice');
console.log(greeting); // "Hello, Alice!"

// 複雑な戻り値を持つ関数の呼び出し
try {
	const result = await worker.call('processFile', '/path/to/file.txt');
	console.log(`File size: ${result.size}, lines: ${result.lines}`);
} catch (error) {
	console.error('Error processing file:', error);
}

// プロセスのクローズ
await worker.close();
```

##### `initialized(): Promise<void>`

子プロセスの初期化が完了するまで待機します。`type: 'main'` で作成された `ProcTalk` インスタンスで使用します。

###### 戻り値

`Promise<void>`: 子プロセスが初期化を完了すると解決される Promise

###### 例

```typescript
const worker = new ProcTalk<API>({
	type: 'main',
	subModulePath: './worker.js',
});

// 初期化完了を待つ
await worker.initialized();

// これで安全に call() を使用できる
const result = await worker.call('someMethod', arg1, arg2);
```

##### `close(): Promise<void>`

メインプロセス側から子プロセスを終了します。子プロセスのクリーンアップ関数が実行され、プロセスが正常に終了するまで待機します。

###### 戻り値

`Promise<void>`: 子プロセスが終了すると解決される Promise

###### 例

```typescript
const worker = new ProcTalk<API>({
	type: 'main',
	subModulePath: './worker.js',
});

await worker.initialized();

// 処理を実行
await worker.call('doSomething');

// プロセスを終了（クリーンアップ関数が実行される）
await worker.close();
```

##### `log(...args: Parameters<typeof log>): void`

デバッグログを出力します。環境変数 `DEBUG=@d-zero:proc-talk*` を設定すると、詳細なログが出力されます。

###### パラメータ

- `...args`: `debug` パッケージの `log` 関数に渡される引数

###### 例

```typescript
const proc = new ProcTalk<API>({
	type: 'child',
	process() {
		proc.log('Worker initialized with PID:', proc.pid);
	},
});
```

#### プロパティ

##### `pid: number`

プロセス ID を取得します（読み取り専用）。

###### 戻り値

`number`: プロセス ID。取得できない場合は `-1`

###### 例

```typescript
const worker = new ProcTalk<API>({
	type: 'main',
	subModulePath: './worker.js',
});

console.log(`Worker PID: ${worker.pid}`);
```

## 完全な使用例

### シンプルな計算ワーカー

**main.ts**

```typescript
import { ProcTalk } from '@d-zero/proc-talk';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type CalcAPI = {
	fibonacci: (n: number) => number;
	factorial: (n: number) => number;
};

async function main() {
	// ワーカープロセスを起動
	const worker = new ProcTalk<CalcAPI>({
		type: 'main',
		subModulePath: join(__dirname, 'worker.js'),
	});

	// 初期化完了を待つ
	await worker.initialized();
	console.log(`Worker started with PID: ${worker.pid}`);

	// フィボナッチ数列を計算
	const fib = await worker.call('fibonacci', 10);
	console.log(`fibonacci(10) = ${fib}`);

	// 階乗を計算
	const fact = await worker.call('factorial', 5);
	console.log(`factorial(5) = ${fact}`);

	// ワーカーを終了
	await worker.close();
	console.log('Worker closed');
}

main().catch(console.error);
```

**worker.ts**

```typescript
import { ProcTalk } from '@d-zero/proc-talk';

type CalcAPI = {
	fibonacci: (n: number) => number;
	factorial: (n: number) => number;
};

const worker = new ProcTalk<CalcAPI>({
	type: 'child',
	title: 'calc-worker',
	process() {
		console.log('Worker process started');

		// フィボナッチ数列の計算をバインド
		worker.bind('fibonacci', (n: number) => {
			if (n <= 1) return n;
			let a = 0,
				b = 1;
			for (let i = 2; i <= n; i++) {
				[a, b] = [b, a + b];
			}
			return b;
		});

		// 階乗の計算をバインド
		worker.bind('factorial', (n: number) => {
			if (n <= 1) return 1;
			let result = 1;
			for (let i = 2; i <= n; i++) {
				result *= i;
			}
			return result;
		});

		// クリーンアップ関数を返す
		return () => {
			console.log('Worker process cleaning up');
		};
	},
});
```

### オプションを使用したデータ処理ワーカー

**main.ts**

```typescript
import { ProcTalk } from '@d-zero/proc-talk';
import { join } from 'node:path';

type ProcessorAPI = {
	processText: (text: string) => Promise<{
		wordCount: number;
		charCount: number;
		processed: string;
	}>;
};

type ProcessorOptions = {
	uppercase: boolean;
	trim: boolean;
};

async function main() {
	const processor = new ProcTalk<ProcessorAPI, ProcessorOptions>({
		type: 'main',
		subModulePath: join(__dirname, 'processor.js'),
		options: {
			uppercase: true,
			trim: true,
		},
	});

	await processor.initialized();

	const result = await processor.call('processText', '  Hello World  ');
	console.log(result);
	// { wordCount: 2, charCount: 11, processed: 'HELLO WORLD' }

	await processor.close();
}

main().catch(console.error);
```

**processor.ts**

```typescript
import { ProcTalk } from '@d-zero/proc-talk';

type ProcessorAPI = {
	processText: (text: string) => Promise<{
		wordCount: number;
		charCount: number;
		processed: string;
	}>;
};

type ProcessorOptions = {
	uppercase: boolean;
	trim: boolean;
};

const processor = new ProcTalk<ProcessorAPI, ProcessorOptions>({
	type: 'child',
	title: 'text-processor',
	process(options) {
		console.log('Processor started with options:', options);

		processor.bind('processText', async (text: string) => {
			let processed = text;

			if (options?.trim) {
				processed = processed.trim();
			}

			if (options?.uppercase) {
				processed = processed.toUpperCase();
			}

			return {
				wordCount: processed.split(/\s+/).length,
				charCount: processed.length,
				processed,
			};
		});

		return () => {
			console.log('Processor cleanup');
		};
	},
});
```

## デバッグ

環境変数 `DEBUG` を設定することで、詳細なデバッグログを出力できます：

```bash
# すべてのログを表示
DEBUG=@d-zero:proc-talk* node main.js

# 初期化ログのみ表示
DEBUG=@d-zero:proc-talk*:init node main.js

# 関数呼び出しログのみ表示
DEBUG=@d-zero:proc-talk*:call node main.js
```

## 型安全性

`ProcTalk` は TypeScript の型システムを活用して、型安全なプロセス間通信を実現します：

- `bind()` でバインドする関数は、型定義 `T` のシグネチャに一致する必要があります
- `call()` の引数と戻り値は、型定義 `T` に基づいて自動的に推論されます
- コンパイル時に型チェックが行われ、ランタイムエラーを防ぎます

```typescript
type API = {
	add: (a: number, b: number) => number;
};

const worker = new ProcTalk<API>({
	/* ... */
});

// OK: 正しい型
await worker.call('add', 1, 2);

// コンパイルエラー: 引数の型が間違っている
await worker.call('add', '1', '2');

// コンパイルエラー: 存在しない関数名
await worker.call('subtract', 1, 2);
```
