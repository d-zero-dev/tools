# random-int

指定された範囲内でランダムな整数を生成するシンプルなユーティリティ関数。このモジュールは、より複雑な確率分布機能（[sample-distribution](./sample-distribution.md)）の基礎となる基本的なランダム整数生成のロジックを実装しています。

## 関数

### `randomInt(range)`

指定された範囲内でランダムな整数を生成します。

**パラメータ:**

- `range: RandomIntRange` - ランダム整数の範囲指定

**戻り値:**

- `number` - 指定された範囲内のランダムな整数値

**例:**

```typescript
import { randomInt } from '@d-zero/shared/random-int';

// 0から99までのランダムな整数を生成
const value1 = randomInt(100);
console.log(value1); // 0, 1, 2, ..., 99 のいずれか

// 10から19までのランダムな整数を生成
const value2 = randomInt({ min: 10, max: 20 });
console.log(value2); // 10, 11, 12, ..., 19 のいずれか

// サイコロのシミュレーション（1から6）
const dice = randomInt({ min: 1, max: 7 });
console.log(dice); // 1, 2, 3, 4, 5, 6 のいずれか

// 配列のランダムなインデックス
const array = ['a', 'b', 'c', 'd', 'e'];
const randomIndex = randomInt(array.length);
console.log(array[randomIndex]); // 配列の要素のいずれか

// ランダムな遅延時間（ミリ秒）
const delayMs = randomInt({ min: 100, max: 1000 });
await delay(delayMs); // [delay](./delay.md) を参照
```

## 型定義

### `RandomIntRange`

ランダム整数の範囲を指定する型。以下の2つの形式が利用可能です：

```typescript
export type RandomIntRange = number | { min: number; max: number };
```

- `number`: `0`から指定値（未満）までの範囲
  - 例: `100` → `0`から`99`までの整数
- `{ min: number; max: number }`: 最小値から最大値（未満）までの範囲
  - 例: `{ min: 10, max: 20 }` → `10`から`19`までの整数

## 特性

### 一様分布（Uniform Distribution）

この関数は**一様分布**に従ってランダムな整数を生成します。つまり、範囲内のすべての整数が同じ確率で出現します。

### 範囲の仕様

- **開始値（inclusive）**: 生成される値は最小値以上です
- **終了値（exclusive）**: 生成される値は最大値**未満**です

これは、JavaScriptの`Array.prototype.slice()`や`String.prototype.substring()`と同じ仕様です。

```typescript
randomInt(10); // [0, 10) → 0, 1, 2, ..., 9
randomInt({ min: 10, max: 20 }); // [10, 20) → 10, 11, 12, ..., 19
```

## パフォーマンス

- **計算量**: O(1) - 常に一定時間で実行
- **メモリ使用量**: O(1) - 追加のメモリを必要としない
- **乱数生成**: JavaScriptの`Math.random()`に依存（暗号学的に安全ではない）

## 注意事項

### 範囲の指定

- `min >= max`の場合、動作は保証されません（負の値や範囲外の値が返される可能性があります）
- 負の値も指定可能ですが、通常は正の整数範囲での使用を推奨します

### 乱数の品質

- `Math.random()`は疑似乱数生成器を使用しており、暗号学的に安全ではありません
- セキュリティが重要な用途では、`crypto.getRandomValues()`を使用することを検討してください

## 使い分けの指針

- **`randomInt`を使う場合**:
  - シンプルな一様分布のランダム整数が必要
  - パフォーマンスが重要
  - 確率分布の調整が不要

- **[`sampleDistribution`](./sample-distribution.md)を使う場合**:
  - 正規分布や三角分布など、特定の確率分布が必要
  - 平均値付近に集中させたい、特定の値に偏らせたいなど、分布の調整が必要

## 関連モジュール

- [sample-distribution](./sample-distribution.md) - より高度な確率分布機能（この関数を使用）
- [delay](./delay.md) - 遅延機能での使用例
