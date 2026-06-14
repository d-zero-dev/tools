# `@d-zero/fs`

zip アーカイブの作成・展開ユーティリティ。

## Installation

```sh
yarn add @d-zero/fs
```

## Usage

```ts
import { zip, unzip, extractZip } from '@d-zero/fs/zip';

await zip('archive.zip', 'targetDir');
await unzip('archive.zip', 'extractDir');
const directory = await extractZip('archive.zip');
```
