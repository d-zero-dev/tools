# `@d-zero/readtext`

テキストファイルを「リスト」「キー値リスト」「グリッド」として読み込むユーティリティ。

共通契約: **空行と `#` で始まる行は無視**される。

## Installation

```sh
yarn add @d-zero/readtext
```

## Usage

### `readList` — 1 行 1 要素

```ts
import { readList } from '@d-zero/readtext/list';

const list = await readList('path/to/file.txt');
```

第 2 引数に区切り文字（`string | RegExp`）を渡すと `{ key, value }` の配列になる:

```ts
const kv = await readList('path/to/file.txt', ' ');
```

### `readGrid` — 区切り文字で 2D 配列

```ts
import { readGrid } from '@d-zero/readtext/grid';

const grid = await readGrid<[string, string, string]>('path/to/file.txt');
```

第 2 引数で区切り文字を変更（デフォルト `/\s+/`）。
