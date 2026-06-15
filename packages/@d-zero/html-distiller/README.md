# `@d-zero/html-distiller`

HTML から不要な要素を削除し、機械可読な JSON ツリーに変換するユーティリティ。

## Installation

```sh
yarn add @d-zero/html-distiller
```

## Usage

```ts
import { distill } from '@d-zero/html-distiller';

const result = distill(
	'<!doctype html><html lang="en"><body><h1>Hello</h1></body></html>',
);
```
