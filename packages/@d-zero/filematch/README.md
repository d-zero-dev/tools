# `@d-zero/filematch`

2 つのファイルパスまたは URL の**バイト単位の完全一致判定**を行う CLI / API。差分検出ではなく「同じか違うか」のみ返す。用途・制約の WHY は `src/compare.ts` の JSDoc を参照。

## Installation

```sh
yarn add @d-zero/filematch
```

## Usage

```sh
# CLI
npx @d-zero/filematch ./test1.pdf ./test2.pdf
npx @d-zero/filematch -f list.txt
```

リストファイル形式: `<file1> <file2>` を 1 行ずつ。

```ts
// API
import { compare } from '@d-zero/filematch';

const same = await compare('./test1.pdf', './test2.pdf');
```
