# `@d-zero/roar`

A CLI helper library built on top of [meow](https://github.com/sindresorhus/meow) with enhanced type safety and command support.

## Installation

```bash
npm install @d-zero/roar
```

## Features

- 🎯 **Type-safe CLI definitions** - Full TypeScript support with generic types
- 🚀 **Command-based routing** - Easy command parsing with type inference
- 📝 **Auto-generated help** - Beautiful help text using cli-meow-help
- ⚡ **Built on meow** - Leverage the power of the popular meow library
- 🎨 **Customizable** - Header, footer, and error handling support

## Usage

### Basic CLI (No Commands)

シンプルなCLIツールを作成する場合：

```typescript
import { roar } from '@d-zero/roar';

const cli = roar({
	name: 'my-tool',
	description: 'A simple CLI tool',
	flags: {
		verbose: {
			type: 'boolean',
			shortFlag: 'v',
			description: 'Enable verbose output',
		},
		output: {
			type: 'string',
			shortFlag: 'o',
			description: 'Output file path',
		},
	},
});

console.log('Args:', cli.args);
console.log('Flags:', cli.flags);
// cli.flags.verbose: boolean
// cli.flags.output: string | undefined
```

### CLI with Commands

コマンドベースのCLIを作成する場合：

```typescript
import { roar } from '@d-zero/roar';

const cli = roar({
	name: 'git-tool',
	description: 'A git-like CLI tool',
	header: 'My Git Tool v1.0.0',
	footer: 'For more information, visit https://example.com',
	commands: {
		clone: { desc: 'Clone a repository' },
		pull: { desc: 'Pull changes from remote' },
		push: { desc: 'Push changes to remote' },
	},
	flags: {
		force: {
			type: 'boolean',
			shortFlag: 'f',
			description: 'Force operation',
		},
	},
});

// cli.command: 'clone' | 'pull' | 'push' | undefined
switch (cli.command) {
	case 'clone':
		console.log('Cloning repository...', cli.args);
		break;
	case 'pull':
		console.log('Pulling changes...', cli.flags.force);
		break;
	case 'push':
		console.log('Pushing changes...');
		break;
}
```

### Error Handling

カスタムエラーハンドラを設定する場合：

```typescript
const cli = roar({
	name: 'my-cli',
	commands: {
		build: { desc: 'Build the project' },
		test: { desc: 'Run tests' },
	},
	flags: {},
	onError: (error) => {
		console.error('Error:', error.message);
		// true を返すとヘルプを表示してプロセス終了
		// false を返すとヘルプを表示せずにプロセス終了
		return true;
	},
});
```

## API

### `roar<CommandType, Flags>(settings)`

CLIアプリケーションを作成します。

#### Parameters

- `settings`: `CliSettings<CommandType, Flags>` - CLI設定オブジェクト

##### `CliSettings` Properties

| Property      | Type                                    | Required | Description                        |
| ------------- | --------------------------------------- | -------- | ---------------------------------- |
| `name`        | `string`                                | ✓        | CLIツールの名前                    |
| `description` | `string`                                | -        | CLIツールの説明                    |
| `header`      | `string`                                | -        | ヘルプテキストのヘッダー           |
| `footer`      | `string`                                | -        | ヘルプテキストのフッター           |
| `commands`    | `Record<CommandType, { desc: string }>` | -        | 利用可能なコマンド定義             |
| `flags`       | `Options<Flags>['flags']`               | ✓        | フラグ定義（meow互換）             |
| `onError`     | `(error: Error) => boolean`             | -        | エラーハンドラ（trueでヘルプ表示） |

#### Returns

`RoarResult<CommandType, Flags>` オブジェクト：

| Property  | Type                       | Description                              |
| --------- | -------------------------- | ---------------------------------------- |
| `command` | `CommandType \| undefined` | 実行されたコマンド（コマンド定義時のみ） |
| `args`    | `string[]`                 | コマンドライン引数の配列                 |
| `flags`   | `Result<Flags>['flags']`   | パースされたフラグオブジェクト           |

## Examples

### 実践的な例：ファイル処理ツール

```typescript
import { roar } from '@d-zero/roar';
import { readFile, writeFile } from 'node:fs/promises';

const cli = roar({
	name: 'file-processor',
	description: 'Process files with various operations',
	commands: {
		convert: { desc: 'Convert file format' },
		compress: { desc: 'Compress files' },
		extract: { desc: 'Extract archive' },
	},
	flags: {
		input: {
			type: 'string',
			shortFlag: 'i',
			description: 'Input file path',
			isRequired: true,
		},
		output: {
			type: 'string',
			shortFlag: 'o',
			description: 'Output file path',
		},
		verbose: {
			type: 'boolean',
			shortFlag: 'v',
			description: 'Verbose output',
			default: false,
		},
	},
	onError: (error) => {
		console.error(`❌ ${error.message}`);
		return true;
	},
});

async function main() {
	const inputPath = cli.flags.input;
	const outputPath = cli.flags.output ?? `${inputPath}.out`;
	const verbose = cli.flags.verbose;

	switch (cli.command) {
		case 'convert':
			if (verbose) console.log(`Converting ${inputPath} to ${outputPath}`);
			// 変換処理
			break;
		case 'compress':
			if (verbose) console.log(`Compressing ${inputPath}`);
			// 圧縮処理
			break;
		case 'extract':
			if (verbose) console.log(`Extracting ${inputPath}`);
			// 解凍処理
			break;
	}
}

main();
```

## Type Safety

`roar`はジェネリック型を活用して完全な型安全性を提供します：

```typescript
// コマンド型が推論される
const cli = roar({
	commands: {
		start: { desc: 'Start server' },
		stop: { desc: 'Stop server' },
	},
	flags: {
		port: { type: 'number' },
	},
});

// ✅ 型安全：cli.command は 'start' | 'stop' | undefined
if (cli.command === 'start') {
	// OK
}

// ❌ TypeScriptエラー：'invalid' は許可されていない
if (cli.command === 'invalid') {
	// エラー
}

// ✅ 型安全：cli.flags.port は number | undefined
const port: number = cli.flags.port ?? 3000;
```

## Related

- [meow](https://github.com/sindresorhus/meow) - Base CLI helper
- [cli-meow-help](https://github.com/jdillard/cli-meow-help) - Help text formatter

## License

MIT
