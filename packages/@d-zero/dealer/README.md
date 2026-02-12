# Dealer

Dealer is an API and CLI that processes a given collection in parallel and logs the output in sequence to the standard output.

## Install

```shell
npm install @d-zero/dealer
```

## API

### 基本的な使い方

```ts
import { deal } from '@d-zero/dealer';

await deal(
	items,
	(item, update, index, setLineHeader, push) => {
		item.setup();
		item.addListeners((state) => {
			update(`item(${index}): ${state}`);
		});

		return async () => {
			await item.start();
			item.cleanup();
		};
	},
	{
		limit: 30,
		header: (progress, done, total, limit) =>
			progress === 1
				? 'HeaderMessage: Done!'
				: `HeaderMessage: %earth% %dots% %block% %propeller%`,
	},
);
```

### deal関数

コレクションを並列処理し、ログを順次出力します。

#### シグネチャ

```ts
async function deal<T extends WeakKey>(
	items: readonly T[],
	setup: (
		process: T,
		update: (log: string) => void,
		index: number,
		setLineHeader: (lineHeader: string) => void,
		push: (...items: T[]) => Promise<void>,
	) => Promise<() => void | Promise<void>> | (() => void | Promise<void>),
	options?: DealOptions,
): Promise<void>;
```

#### パラメータ

- `items`: 処理対象のアイテムのコレクション
- `setup`: 各アイテムを初期化し、開始関数を返す関数
  - `process`: 現在処理中のアイテム
  - `update`: ログを更新する関数
  - `index`: アイテムのインデックス
  - `setLineHeader`: ログの各行にプレフィックスを設定する関数
  - `push`: 実行中にアイテムをキューに追加する関数
  - 戻り値: アイテムを開始する関数
- `options`: 設定オプション

#### 実行フロー

1. `dealer.play()` が並列処理を開始
2. 各ワーカーについて:
   - `start()` 関数が呼び出される(アイテムが開始)
   - **インターバル遅延が実行される**(options.intervalが指定されている場合)
     - 待機ログが `%countdown()` 形式で出力される
     - これはアイテム開始**後**、最初の出力の**前**に発生
   - 実際の処理が始まる(ユーザーコードからの最初の `update()` 呼び出し)

### DealOptions型

```ts
type DealOptions = DealerOptions &
	LanesOptions & {
		readonly header?: DealHeader;
		readonly debug?: boolean;
		readonly interval?: number | DelayOptions;
	};
```

#### プロパティ

- `limit?: number`: 同時実行数の制限(デフォルト: 10)
- `onPush?: (item: T) => boolean`: `push()`時のフィルタ関数。`false`を返すとそのアイテムは拒否される(例: 重複排除)
- `header?: DealHeader`: 進捗ヘッダーを生成する関数
- `debug?: boolean`: デバッグログを表示するかどうか
- `interval?: number | DelayOptions`: 各処理の間隔(ミリ秒またはDelayOptions)
- `animations?: Animations`: アニメーション定義
- `fps?: FPS`: フレームレート(12, 24, 30, 60)
- `indent?: string`: ログのインデント文字列
- `sort?: (a: [number, string], b: [number, string]) => number`: ログのソート関数
- `verbose?: boolean`: 詳細ログモード

### DealHeader型

進捗情報をヘッダー文字列に変換する関数型です。

```ts
type DealHeader = (
	progress: number,
	done: number,
	total: number,
	limit: number,
) => string;
```

#### パラメータ

- `progress`: 進捗率(0〜1)
- `done`: 完了したアイテム数
- `total`: 総アイテム数
- `limit`: 同時実行数制限

#### 戻り値

ヘッダーとして表示する文字列。アニメーション変数(`%earth%`, `%dots%`など)を含めることができます。

### Dealerクラス

並列処理を制御するクラスです。

#### コンストラクタ

```ts
constructor(items: readonly T[], options?: DealerOptions)
```

- `items`: 処理対象のアイテム
- `options.limit`: 同時実行数の制限(デフォルト: 10)
- `options.onPush`: `push()`時のフィルタ関数

#### メソッド

##### debug(listener: (log: string) => void)

デバッグログのリスナーを設定します。

```ts
dealer.debug((log) => {
	console.log(`[DEBUG]: ${log}`);
});
```

##### finish(listener: () => void)

すべての処理が完了したときのリスナーを設定します。

```ts
dealer.finish(() => {
	console.log('All done!');
});
```

##### play()

並列処理を開始します。

```ts
dealer.play();
```

##### progress(listener: (progress: number, done: number, total: number, limit: number) => void)

進捗更新のリスナーを設定します。

```ts
dealer.progress((progress, done, total, limit) => {
	console.log(`Progress: ${(progress * 100).toFixed(1)}% (${done}/${total})`);
});
```

##### async push(...items: T[])

実行中にアイテムをキューに追加します。追加されたアイテムには`setup()`で設定した初期化関数が自動適用されます。完了後の呼び出しは無視されます。

```ts
await dealer.push(newItem1, newItem2);
```

- `items`: 追加するアイテム。`onPush`が設定されている場合、`false`を返したアイテムはスキップされます。

##### async setup(initializer: ProcessInitializer<T>)

各アイテムの初期化関数を設定します。

```ts
await dealer.setup(async (item, index) => {
	// 初期化処理
	return async () => {
		// 実行処理
	};
});
```

- `initializer`: 各アイテムを初期化し、開始関数を返す関数
  - `process`: 現在のアイテム
  - `index`: アイテムのインデックス
  - 戻り値: アイテムを開始する非同期関数

### Lanesクラス

複数のログラインを管理し、順序付きで表示するクラスです。

#### コンストラクタ

```ts
constructor(options?: LanesOptions)
```

- `options.animations`: アニメーション定義
- `options.fps`: フレームレート(12, 24, 30, 60)
- `options.indent`: ログのインデント文字列
- `options.sort`: ログのソート関数
- `options.verbose`: 詳細ログモード(true の場合、ログをクリアせずに追加表示)

#### メソッド

##### clear(options?: { header?: boolean })

すべてのログをクリアします。

```ts
lanes.clear(); // ログのみクリア
lanes.clear({ header: true }); // ヘッダーもクリア
```

- `options.header`: ヘッダーもクリアするかどうか(デフォルト: false)

注: verboseモードでは何もしません。

##### close()

ディスプレイを閉じます。

```ts
lanes.close();
```

##### delete(id: number)

指定したIDのログを削除します。

```ts
lanes.delete(42);
```

- `id`: 削除するログのID

注: verboseモードでは何もしません。

##### header(text: string)

ヘッダーテキストを設定します。

```ts
lanes.header('Processing items...');
```

- `text`: ヘッダーとして表示するテキスト

##### update(id: number, log: string)

指定したIDのログを更新します。

```ts
lanes.update(42, 'Item 42: Processing...');
```

- `id`: 更新するログのID
- `log`: ログメッセージ

注: verboseモードでは、ヘッダーとログを連結して即座に出力します。

##### write()

現在のログをすべて表示します。

```ts
lanes.write();
```

注: verboseモードでは何もしません。通常モードでは、ソート後のログをヘッダーと共に出力します。
