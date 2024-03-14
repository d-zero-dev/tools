# `@d-zero/readtext`

テキストファイル処理のためのツールです。

## インストール

```sh
yarn install @d-zero/readtext
```

## 使い方

### `@d-zero/readtext/list`

1行1要素のテキストファイルを読み込み配列として返します。
`#`で始まる行はコメントとして無視されます。

```txt file.txt
apple
orange
# It is comment
banana
melon
```

```ts
import { readList } from '@d-zero/readtext/list';

const list: string[] = await readList('path/to/file.txt');

// => ["apple", "orange", "banana", "melon"]
```

### `@d-zero/readtext/grid`

特定の区切り文字のテキストファイルを読み込み2次元配列として返します。
`#`で始まる行はコメントとして無視されます。

```txt file.txt
apple 100 200
orange 300 400
# It is comment
banana 500 600
melon 700 800
```

```ts
import { readGrid } from '@d-zero/readtext/grid';

const grid: string[][] = await readGrid('path/to/file.txt');

// => [["apple", "100", "200"], ["orange", "300", "400"], ["banana", "500", "600"], ["melon", "700", "800"]]
```

#### 区切り文字の指定

`readGrid`関数の第2引数に区切り文字を指定することで、区切り文字を変更できます。

```ts
const commaSeparatedGrid = await readGrid('path/to/file.txt', ',');
const tabSeparatedGrid = await readGrid('path/to/file.txt', '\t');
const spaceSeparatedGrid = await readGrid('path/to/file.txt', /\s+/);
```

#### タプル型の指定

`readGrid`関数にジェネリクスを指定することで、各行の要素の型を指定できます。配列の要素は`string`型となります。

```ts
const threeColumnsGrid = await readGrid<[string, string, string]>('path/to/file.txt');
```
