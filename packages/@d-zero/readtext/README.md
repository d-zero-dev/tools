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

#### キーと値のペアとして読み込む

`readList`関数の第2引数に区切り文字を指定することで、各行をキーと値のペアとして読み込むことができます。

```txt file.txt
name John
age 30
# It is comment
city Tokyo
country Japan
```

```ts
import { readList } from '@d-zero/readtext/list';

const kvList = await readList('path/to/file.txt', ' ');

// => [
//   { key: "name", value: "John" },
//   { key: "age", value: "30" },
//   { key: "city", value: "Tokyo" },
//   { key: "country", value: "Japan" }
// ]
```

区切り文字は文字列または正規表現を指定できます。

```ts
const colonSeparated = await readList('path/to/file.txt', ':');
const tabSeparated = await readList('path/to/file.txt', '\t');
const whitespaceSeparated = await readList('path/to/file.txt', /\s+/);
```

### ヘルパー関数

#### `toList`

文字列をリストに変換します。空行と`#`で始まるコメント行は無視されます。

```ts
import { toList } from '@d-zero/readtext/list';

const text = `
apple
orange
# It is comment
banana
melon
`;

const list: string[] = toList(text);

// => ["apple", "orange", "banana", "melon"]
```

#### `toKvList`

文字列をキーと値のペアのリストに変換します。各行を指定された区切り文字で分割してキーと値のペアにします。空行と`#`で始まるコメント行は無視されます。

```ts
import { toKvList } from '@d-zero/readtext/list';

const text = `
name John
age 30
# It is comment
city Tokyo
country Japan
`;

const kvList = toKvList(text, ' ');

// => [
//   { key: "name", value: "John" },
//   { key: "age", value: "30" },
//   { key: "city", value: "Tokyo" },
//   { key: "country", value: "Japan" }
// ]
```

区切り文字はオプショナルで、デフォルトは`/\s+/`(1つ以上の空白文字)です。

```ts
const kvList = toKvList(text); // デフォルトの区切り文字を使用
const colonSeparated = toKvList(text, ':');
const tabSeparated = toKvList(text, '\t');
```

区切り文字が見つからない行は、行全体がキーとなり値は空文字列となります。

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
