# sample-distribution

様々な確率分布からランダムな値をサンプリング（抽出）するための汎用的な数学ユーティリティ。統計学の標準的な用語（`sample`、`distribution`）を使用しており、PythonのNumPyやSciPyなどのライブラリと同様の命名規則に従っています。

## 関数

### `sampleDistribution(range, distribution?)`

指定された確率分布に従ってランダムな整数値を生成します。

**パラメータ:**

- `range: RandomIntRange` - ランダム整数の範囲指定。詳細は[random-int](./random-int.md)を参照
- `distribution?: DistributionPreset | BimodalDistribution | CustomDistribution` - 確率分布の種類。指定しない場合は一様分布

**戻り値:**

- `number` - 指定された範囲内のランダムな整数値

**例:**

```typescript
import { sampleDistribution } from '@d-zero/shared/sample-distribution';

// 一様分布からサンプルを取得（number形式: 0から100未満）
const value0 = sampleDistribution(100);

// 一様分布からサンプルを取得（{min, max}形式）
const value1 = sampleDistribution({ min: 0, max: 100 });

// 正規分布からサンプルを取得
const value2 = sampleDistribution({ min: 0, max: 100 }, 'normal');

// 二峰性分布からサンプルを取得（デフォルトピーク）
const value3 = sampleDistribution({ min: 0, max: 100 }, { type: 'bimodal' });

// 二峰性分布からサンプルを取得（カスタムピーク）
const value4 = sampleDistribution(
	{ min: 0, max: 100 },
	{ type: 'bimodal', peaks: [0.3, 0.7] },
);

// カスタム分布からサンプルを取得
const value5 = sampleDistribution(
	{ min: 0, max: 100 },
	{
		type: 'custom',
		weight: (t) => t * t,
	},
);
```

## 型定義

### `DistributionPreset`

プリセットされた確率分布の種類を表す文字列リテラル型。

```typescript
export type DistributionPreset =
	| 'uniform' // 一様分布（すべての値が同じ確率）
	| 'normal' // 正規分布（平均値付近に集中）
	| 'triangular' // 三角分布（中央にピーク）
	| 'right-skewed' // 右に偏った分布（大きい値ほど確率が高い）
	| 'left-skewed'; // 左に偏った分布（小さい値ほど確率が高い）
```

### `BimodalDistribution`

二峰性分布の設定を表す型。

```typescript
export type BimodalDistribution = {
	type: 'bimodal';
	peaks?: [number, number]; // ピーク位置（正規化された[0,1]の範囲）。デフォルトは[0.25, 0.75]
};
```

### `CustomDistribution`

カスタムの重み関数を指定した分布。

```typescript
export type CustomDistribution = {
	type: 'custom';
	weight: (t: number) => number; // 正規化位置[0,1]を重み[0,∞)にマッピング
};
```

## 実装されている分布

### 一様分布（Uniform Distribution）

すべての値が同じ確率で発生する分布。内部的に[`randomInt`関数](./random-int.md)を使用します。

```typescript
sampleDistribution(100); // 0から100未満
// または
sampleDistribution({ min: 0, max: 100 });
// または
sampleDistribution({ min: 0, max: 100 }, 'uniform');
```

### 正規分布（Normal Distribution）

平均値付近に集中し、標準偏差に基づいて広がる分布。ベルカーブの形状が特徴的です。

```typescript
sampleDistribution({ min: 0, max: 100 }, 'normal');
```

**実装:** Box-Muller変換を使用

- 平均値: `(min + max) / 2`
- 標準偏差: `(max - min) / 6`（約99.7%が範囲内に収まる）

### 三角分布（Triangular Distribution）

最小値、最大値、最頻値（モード）の3点で定義される分布。中央にピークを持ちます。

```typescript
sampleDistribution({ min: 0, max: 100 }, 'triangular');
```

**実装:** 逆変換サンプリングの解析的手法を使用

- モードは中央（`(min + max) / 2`）に設定

### 二峰性分布（Bimodal Distribution）

2つのピークを持つ分布。2つの正規分布を混合した分布です。

```typescript
// デフォルトピーク（25%と75%の位置）
sampleDistribution({ min: 0, max: 100 }, { type: 'bimodal' });

// カスタムピーク
sampleDistribution(
	{ min: 0, max: 100 },
	{ type: 'bimodal', peaks: [0.25, 0.75] }, // 25%と75%の位置にピーク
);
```

**実装:** 2つの正規分布の平均値を設定し、ランダムにどちらかのピークを選択。標準偏差は範囲の1/12に設定（ピークを分離させるため）

### 右に偏った分布（Right-Skewed Distribution）

大きい値ほど確率が高い分布。線形の重み関数 `w(t) = t` を使用します。

```typescript
sampleDistribution({ min: 0, max: 100 }, 'right-skewed');
```

**実装:** 解析的な逆CDF（累積分布関数の逆関数）を使用

- CDF: `F(t) = t²`
- 逆CDF: `t = √u`（uは一様乱数）
- O(1)の計算量で高速

### 左に偏った分布（Left-Skewed Distribution）

小さい値ほど確率が高い分布。線形の重み関数 `w(t) = 1 - t` を使用します。

```typescript
sampleDistribution({ min: 0, max: 100 }, 'left-skewed');
```

**実装:** 解析的な逆CDFを使用

- CDF: `F(t) = 2t - t²`
- 逆CDF: `t = 1 - √(1 - u)`
- O(1)の計算量で高速

### カスタム分布（Custom Distribution）

任意の重み関数を指定できる分布。

```typescript
sampleDistribution(
	{ min: 0, max: 100 },
	{
		type: 'custom',
		weight: (t) => t * t, // 二乗の重み関数
	},
);
```

**実装:** 数値積分を使用して重み関数の積分を計算し、二分探索で逆変換サンプリングを実行。O(n log n)の計算量（nは積分のサンプル数、デフォルト1000）

## パフォーマンス

- **一様分布**: O(1) - 最も高速
- **正規分布**: O(1) - Box-Muller変換で高速
- **三角分布**: O(1) - 解析的な逆CDFで高速
- **二峰性分布**: O(1) - 正規分布の呼び出しのみ
- **右/左に偏った分布**: O(1) - 解析的な逆CDFで高速
- **カスタム分布**: O(n log n) - 数値積分と二分探索が必要（nは積分サンプル数、デフォルト1000）

カスタム分布は計算コストが高いため、大量のサンプルを生成する場合は注意が必要です。

## 使用例

実際の使用例については、[delay](./delay.md)を参照してください。

```typescript
// 二乗の重み関数（右に偏った分布を強化）
const value = sampleDistribution(
	{ min: 0, max: 100 },
	{
		type: 'custom',
		weight: (t) => t * t,
	},
);

// 正弦波の重み関数（周期的な分布）
const value2 = sampleDistribution(
	{ min: 0, max: 100 },
	{
		type: 'custom',
		weight: (t) => Math.sin(t * Math.PI) + 1,
	},
);
```

## 注意事項

- すべての分布で、結果は整数値（`Math.floor`で切り捨て）として返されます
- 正規分布と二峰性分布では、範囲外の値はクリップ（切り詰め）されます
- カスタム分布の重み関数は、負の値を返さないようにしてください（動作は保証されません）
- カスタム分布では、重み関数が0を返す範囲があると、その範囲からはサンプルが生成されません

## 関連モジュール

- [random-int](./random-int.md) - 基本的なランダム整数生成（一様分布の実装に使用）
- [delay](./delay.md) - 遅延機能での使用例
