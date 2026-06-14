# `@d-zero/roar`

サブコマンドごとに型付きフラグを定義できる CLI ヘルパー（[yargs-parser](https://github.com/yargs/yargs-parser) ベース）。

## Installation

```sh
yarn add @d-zero/roar
```

## Usage

```ts
import { parseCli } from '@d-zero/roar';

const result = parseCli({
	name: 'my-tool',
	version: pkg.version,
	commands: {
		crawl: {
			desc: 'Crawl a website',
			flags: {
				depth: { type: 'number', shortFlag: 'd', desc: 'Max depth', default: 10 },
				verbose: { type: 'boolean', shortFlag: 'v', desc: 'Verbose output' },
			},
		},
		analyze: { desc: 'Run analysis' },
	},
	onError: () => true,
});

if (result.command === 'crawl') {
	result.flags.depth; // number（default から推論）
	result.flags.verbose; // boolean | undefined
}
```

位置引数とフラグは任意の順序で混在可能。`--` 以降はすべて位置引数として扱う。

`--version`/`-v` の発火位置（`argv[0]` 限定）、空文字列 `version` の扱い、フラグ型推論の挙動は `src/parse-cli.ts` の JSDoc を参照。
