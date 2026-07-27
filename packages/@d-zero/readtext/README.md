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

### `readListWithPosition` — 元の行番号・列番号付き

`readList` と同じ空行・コメント除外規則だが、各要素の値に加えて元ファイル内の 1-origin の行番号・列番号を保持する。不正な行を警告表示する際など、元の位置に戻す必要がある場合に使う。

```ts
import { readListWithPosition } from '@d-zero/readtext/list';

const items = await readListWithPosition('path/to/file.txt');
// items: [{ value: 'item1', line: 1, column: 1 }, ...]
```

文字列をそのまま渡したい場合は `toListWithPosition` を使う。

### `readGrid` — 区切り文字で 2D 配列

```ts
import { readGrid } from '@d-zero/readtext/grid';

const grid = await readGrid<[string, string, string]>('path/to/file.txt');
```

第 2 引数で区切り文字を変更（デフォルト `/\s+/`）。
