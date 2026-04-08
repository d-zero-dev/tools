# delay

コードの実行を指定した時間だけ遅延させるユーティリティ関数。固定時間の遅延だけでなく、ランダムな遅延時間を生成することも可能で、確率分布を指定してより高度な遅延パターンを実現できます。

## 関数

### `delay(msOrOptions, callback?)`

指定した時間だけ処理を遅延させます。

**パラメータ:**

- `msOrOptions: number | DelayOptions` - 遅延時間（ミリ秒）または遅延オプション。
- `callback?: (determinedInterval: number) => void` - 遅延開始前に呼び出されるコールバック関数。決定された遅延時間が渡されます。

**戻り値:**

- `Promise<void>` - 遅延が完了したら解決されるPromise

**例:**

```typescript
import { delay } from '@d-zero/shared/delay';

// 固定時間の遅延
await delay(1000);

// ランダムな遅延（0-1000ms）
await delay({ random: 1000 });

// ランダムな遅延（500-3000ms）
await delay({ random: { min: 500, max: 3000 } });

// 確率分布を指定した遅延
await delay({
	random: {
		min: 500,
		max: 3000,
		distribution: 'normal',
	},
});

// コールバック関数を使用
await delay({ random: { min: 100, max: 500 } }, (ms) => {
	console.log(`実際の待機時間: ${ms}ms`);
});
```

## 型定義

### `DelayOptions`

遅延オプションを表す型。

```typescript
export type DelayOptions = {
	random: RandomDelayRange;
};
```

### `RandomDelayRange`

ランダム遅延の範囲を指定する型。以下の3つの形式が利用可能です：

- `number`: `0`から指定値（未満）までの範囲
- `{ min: number, max: number }`: 最小値から最大値（未満）までの範囲
- `{ min: number, max: number, distribution? }`: 確率分布を指定した範囲

```typescript
export type RandomDelayRange =
	| number
	| {
			min: number;
			max: number;
			distribution?: DistributionPreset | BimodalDistribution | CustomDistribution;
	  };
```

確率分布の詳細については、[sample-distribution](./sample-distribution.md)を参照してください。

## 確率分布の使用

`random`オプションに`distribution`を指定することで、様々な確率分布に基づいた遅延時間を生成できます。

```typescript
// 正規分布（平均値付近に集中）
await delay({
	random: {
		min: 500,
		max: 3000,
		distribution: 'normal',
	},
});

// 二峰性分布（2つのピークを持つ分布）
await delay({
	random: {
		min: 500,
		max: 3000,
		distribution: {
			type: 'bimodal',
			peaks: [0.2, 0.8], // 20%と80%の位置にピーク
		},
	},
});

// カスタム分布（重み関数を指定）
await delay({
	random: {
		min: 500,
		max: 3000,
		distribution: {
			type: 'custom',
			weight: (t) => t * t, // 大きい値ほど確率が高い
		},
	},
});
```

利用可能な分布の種類については、[sample-distribution](./sample-distribution.md)を参照してください。

## 注意事項

- `delay`関数は非同期関数です。必ず`await`を使用するか、`.then()`で処理してください
- コールバック関数は遅延開始前に同期的に実行されます
- 確率分布を指定しない場合、デフォルトで一様分布が使用されます（[sample-distribution](./sample-distribution.md)を使用し、内部的に[random-int](./random-int.md)を使用）

## 関連モジュール

- [retry](./retry.md) - リトライデコレータ（`delay`を内部で使用し、`onWait`コールバックを`callback`引数に渡す）
- [sample-distribution](./sample-distribution.md) - 確率分布からサンプルを取得するロジック
- [random-int](./random-int.md) - 基本的なランダム整数生成のロジック
