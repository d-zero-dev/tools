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

### エラー表示（`SuppressedError` の分解）

`using`/`await using` のスコープ内で本体の例外と dispose 処理の例外が同時に発生すると、`SuppressedError` が投げられ定型メッセージの裏に根本原因が隠れる。`unwrapSuppressedError` で分解してから表示する:

```ts
import { unwrapSuppressedError } from '@d-zero/cli-core';

try {
	await run();
} catch (error) {
	for (const cause of unwrapSuppressedError(error)) {
		console.error('Error:', cause instanceof Error ? cause.message : cause);
	}
	process.exit(1);
}
```
