# `@d-zero/cli-core`

CLI アプリケーション構築用の共通ユーティリティ（minimist ベース）。

## Installation

```sh
yarn add @d-zero/cli-core
```

## Usage

```ts
import { createCLI, parseCommonOptions, type BaseCLIOptions } from '@d-zero/cli-core';

interface MyOptions extends BaseCLIOptions {
	output?: string;
}

const cli = createCLI<MyOptions>({
	name: pkg.name,
	version: pkg.version,
	aliases: { o: 'output' },
	usage: ['Usage: my-cli [options] <input>'],
	parseArgs: (args) => ({
		...parseCommonOptions(args),
		output: args.output,
	}),
	validateArgs: (options, args) => args._.length > 0,
});
```

`-v`/`--version` の挙動・エイリアス衝突時のフォールバックは `src/cli.ts` の JSDoc を参照。
