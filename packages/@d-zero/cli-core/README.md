# `@d-zero/cli-core`

CLIアプリケーション構築のためのコアユーティリティ。

## モジュール一覧

| Import Path                   | Description                                                  |
| ----------------------------- | ------------------------------------------------------------ |
| `@d-zero/cli-core`            | CLI構築のためのコア機能（`createCLI`, `parseCommonOptions`） |
| `@d-zero/cli-core/parse-list` | カンマ区切りの文字列をパースして配列に変換する関数           |
| `@d-zero/cli-core/types`      | CLI関連のTypeScript型定義                                    |

## API

### `createCLI<T>(config: CLIConfig<T>): ParsedCLI<T>`

CLIアプリケーションを作成し、コマンドライン引数をパースします。検証に失敗した場合は使用方法を表示して終了します。

**パラメータ:**

- `config: CLIConfig<T>` - CLI設定オブジェクト
  - `aliases?: CLIAlias` - コマンドラインオプションのエイリアス定義（例: `{ o: 'output' }`）
  - `usage: string[]` - ヘルプメッセージとして表示される使用方法の文字列配列
  - `parseArgs: (cli: ParsedArgs) => T` - 引数をパースしてオプションオブジェクトに変換する関数
  - `validateArgs: (options: T, cli: ParsedArgs) => boolean` - 引数の妥当性を検証する関数（`false`を返すと終了）

**戻り値:**

`ParsedCLI<T>` オブジェクト:

- `options: T` - パースされたオプション
- `args: string[]` - 位置引数の配列
- `hasConfigFile: boolean` - 設定ファイル（`listfile`オプション）が指定されているかどうか

**使用例:**

```typescript
import { createCLI } from '@d-zero/cli-core';
import type { BaseCLIOptions } from '@d-zero/cli-core/types';

interface MyOptions extends BaseCLIOptions {
	output?: string;
}

const cli = createCLI<MyOptions>({
	aliases: {
		o: 'output',
		l: 'limit',
		d: 'debug',
	},
	usage: [
		'Usage: my-cli [options] <input>',
		'',
		'Options:',
		'  -o, --output <file>  出力ファイルパス',
		'  -l, --limit <num>    処理する最大件数',
		'  -d, --debug          デバッグモードを有効化',
	],
	parseArgs: (cli) => ({
		output: cli.output,
		limit: cli.limit ? Number.parseInt(cli.limit) : undefined,
		debug: !!cli.debug,
	}),
	validateArgs: (options, cli) => {
		return cli._.length > 0; // 少なくとも1つの引数が必要
	},
});

console.log(cli.options); // パースされたオプション
console.log(cli.args); // 位置引数
```

---

### `parseCommonOptions(cli: ParsedArgs): Pick<BaseCLIOptions, 'limit' | 'debug' | 'verbose' | 'interval'>`

共通のCLIオプション（`limit`, `debug`, `verbose`, `interval`）をパースします。`createCLI`の`parseArgs`関数内で使用することを想定しています。

**パラメータ:**

- `cli: ParsedArgs` - `minimist`でパースされた引数オブジェクト

**戻り値:**

以下のプロパティを持つオブジェクト:

- `limit?: number` - 処理する最大件数
- `debug?: boolean` - デバッグモードフラグ
- `verbose?: boolean` - 詳細出力モードフラグ
- `interval?: number | DelayOptions` - 処理間隔（ミリ秒または遅延オプション）

**使用例:**

```typescript
import { createCLI, parseCommonOptions } from '@d-zero/cli-core';

const cli = createCLI({
	parseArgs: (parsedArgs) => {
		const common = parseCommonOptions(parsedArgs);
		return {
			...common,
			// カスタムオプションを追加
			output: parsedArgs.output,
		};
	},
	// ...
});
```

---

### `parseList(listParam: string): string[]`

カンマ区切りの文字列をパースして、トリミングされた文字列の配列に変換します。

**パラメータ:**

- `listParam: string` - カンマ区切りの文字列

**戻り値:**

`string[]` - トリミングされた文字列の配列

**使用例:**

```typescript
import { parseList } from '@d-zero/cli-core/parse-list';

const result = parseList('apple, banana, cherry');
console.log(result); // ['apple', 'banana', 'cherry']

const result2 = parseList('item1,item2,  item3  ');
console.log(result2); // ['item1', 'item2', 'item3']
```
