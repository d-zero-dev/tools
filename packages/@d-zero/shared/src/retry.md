# retry

メソッドにリトライロジックを追加するデコレータファクトリ。指数バックオフ、タイムアウト、フォールバック値、待機開始時のコールバック通知に対応しています。

## 関数

### `retry(options?)`

クラスメソッドに再試行ロジックを付与するデコレータを返します。メソッドが例外をスローした場合、指定された回数まで自動的に再試行します。

**パラメータ:**

- `options?: RetryDecoratorOptions` - リトライデコレータのオプション

**戻り値:**

- クラスメソッドデコレータ関数

**例:**

```typescript
import { retry } from '@d-zero/shared/retry';

class ApiClient {
	// デフォルト設定（5回リトライ、3秒間隔、指数バックオフあり）
	@retry()
	async fetchData() {
		const res = await fetch('https://api.example.com/data');
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	}

	// カスタム設定
	@retry({
		retries: 3,
		interval: 1000,
		timeout: 10_000,
		log: (msg) => console.log(msg),
	})
	async fetchWithTimeout() {
		// ...
	}

	// ランダム間隔 + フォールバック値
	@retry({
		retries: 5,
		interval: { random: { min: 500, max: 3000 } },
		fallback: [],
	})
	async fetchList(): Promise<string[]> {
		// すべてのリトライが失敗した場合、空配列を返す
		// ...
	}

	// onWait コールバックで待機状況を通知
	@retry({
		retries: 3,
		interval: 2000,
		onWait: function (determinedInterval, retryCount, methodName) {
			// `this` はデコレート対象のインスタンスにバインドされる
			console.log(
				`${methodName}: リトライ ${retryCount + 1} 回目、${determinedInterval}ms 待機中...`,
			);
		},
	})
	async fetchWithNotification() {
		// ...
	}
}
```

## 型定義

### `RetryDecoratorOptions`

リトライデコレータのオプションを表す型。

```typescript
export type RetryDecoratorOptions = {
	retries?: number;
	interval?: number | DelayOptions;
	withExponentialBackoff?: boolean;
	timeout?: number;
	fallback?: unknown;
	log?: (message: string) => void;
	onWait?: (determinedInterval: number, retryCount: number, methodName: string) => void;
};
```

| プロパティ               | 型                                                                             | デフォルト  | 説明                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `retries`                | `number`                                                                       | `5`         | 最大リトライ回数                                                                                                                                   |
| `interval`               | `number \| DelayOptions`                                                       | `3000`      | リトライ間隔（ミリ秒）。固定値またはランダム範囲を指定可能。[DelayOptions](./delay.md)を参照                                                       |
| `withExponentialBackoff` | `boolean`                                                                      | `true`      | 指数バックオフの有効化。`true`の場合、間隔が`interval * 2^retryCount`で増加する                                                                    |
| `timeout`                | `number`                                                                       | `0`（無効） | 各リトライ試行のタイムアウト時間（ミリ秒）。タイムアウト時は`RetryTimeoutError`がスローされ、次のリトライに進む                                    |
| `fallback`               | `unknown`                                                                      | —           | すべてのリトライが失敗した場合に返すフォールバック値。truthy値のみ有効（`0`、`""`、`false`等は無視される）。未指定の場合は最初のエラーをスローする |
| `log`                    | `(message: string) => void`                                                    | —           | リトライ時のログ出力関数。失敗回数・エラーメッセージ・待機時間が渡される                                                                           |
| `onWait`                 | `(determinedInterval: number, retryCount: number, methodName: string) => void` | —           | 待機開始時に呼び出されるコールバック。`this`はデコレート対象のインスタンスにバインドされる                                                         |

### `RetryTimeoutError`

タイムアウトによるエラーを表すカスタムエラークラス。`timeout`オプション指定時に、各リトライ試行がタイムアウトした場合にスローされます。

```typescript
class RetryTimeoutError extends Error {
	name = 'RetryTimeoutError';
}
```

## 動作の詳細

### リトライフロー

1. リトライ回数が上限に達しているか確認する
   - 達している場合、`fallback`が指定されていれば（truthy値のみ）その値を返す
   - 未指定の場合、最初のエラーに`[Retried N times]`を付加してスローする
2. デコレートされたメソッドを実行する
3. 成功した場合、結果を返す
4. `Error`インスタンスがスローされた場合、待機時間を計算し（指数バックオフ適用）、`delay()`で待機する
   - `Error`以外がスローされた場合、リトライせずそのままスローする
5. ステップ1に戻る

### 指数バックオフ

`withExponentialBackoff: true`（デフォルト）の場合、待機時間は以下のように増加します:

| リトライ回数 | 乗数 | interval=1000の場合 |
| ------------ | ---- | ------------------- |
| 0            | 1    | 1,000ms             |
| 1            | 2    | 2,000ms             |
| 2            | 4    | 4,000ms             |
| 3            | 8    | 8,000ms             |
| 4            | 16   | 16,000ms            |

`DelayOptions`（ランダム範囲）の場合も同様に、`min`と`max`が乗数でスケーリングされます。

### タイムアウト

`timeout`オプションを指定すると、各リトライ試行は`Promise.race`でタイムアウトと競争します。メソッドの実行がタイムアウトを超えた場合、`RetryTimeoutError`がスローされ、次のリトライに進みます。

### メソッド名の解決

ログや`onWait`コールバックに渡される`methodName`は、`ClassName.methodName`の形式で生成されます（例: `ApiClient.fetchData`）。

## 注意事項

- `retry`はクラスメソッドデコレータです。通常の関数には使用できません
- `Error`インスタンス以外がスローされた場合、リトライせずにそのまま再スローされます
- `retryCount`はデコレータインスタンスごとに保持されます。メソッドを複数回呼び出す場合、リトライカウントは前回の呼び出しから引き継がれます
- `onWait`コールバック内の`this`はデコレート対象のインスタンスにバインドされるため、アロー関数ではなく通常の関数式を使用してください

## 関連モジュール

- [delay](./delay.md) - 遅延実行のロジック（`retry`が内部で使用）
- [parse-interval](./parse-interval.md) - CLI引数から遅延間隔をパースするユーティリティ
