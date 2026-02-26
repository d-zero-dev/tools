# `@d-zero/roar`

サブコマンドごとにフラグ定義を持てる型安全な CLI ヘルパーライブラリです。[yargs-parser](https://github.com/yargs/yargs-parser) をベースに構築されています。

## インストール

```bash
yarn add @d-zero/roar
```

## 特徴

- **サブコマンドディスパッチ** — コマンドごとに独立したフラグ定義と型推論
- **型安全なフラグ** — TypeScript の条件型でフラグ値を正確に推論
- **自動ヘルプ生成** — `--help` / `-h` でコマンドごとのヘルプテキストを表示
- **camelCase → kebab-case 変換** — フラグ名を CLI 表記に自動変換

## 使い方

### 基本的な使い方

```typescript
import { parseCli } from '@d-zero/roar';

const result = parseCli({
	name: 'my-tool',
	commands: {
		crawl: {
			desc: 'Crawl a website',
			flags: {
				depth: { type: 'number', shortFlag: 'd', desc: 'Max depth', default: 10 },
				verbose: { type: 'boolean', shortFlag: 'v', desc: 'Verbose output' },
				url: { type: 'string', shortFlag: 'u', desc: 'Target URL' },
			},
		},
		analyze: {
			desc: 'Run analysis',
		},
	},
	onError: () => true,
});

if (result.command === 'crawl') {
	console.log(result.flags.depth); // number（default: 10 から推論）
	console.log(result.flags.verbose); // boolean | undefined
	console.log(result.flags.url); // string | undefined
}
```

### エラーハンドリング

`onError` コールバックでコマンド未指定や不明なコマンドのエラーを処理できます。`true` を返すとヘルプテキストを stderr に表示してから `process.exit(1)` します。

```typescript
const result = parseCli({
	name: 'my-tool',
	commands: {
		build: { desc: 'Build the project' },
		test: { desc: 'Run tests' },
	},
	onError: (error) => {
		console.error('Error:', error.message);
		return true; // ヘルプを表示
	},
});
```

## API

### `parseCli<Commands>(settings)`

`process.argv` をパースし、マッチしたサブコマンドと型付きフラグを返します。

#### パラメータ

`settings` オブジェクト:

| プロパティ | 型                           | 必須 | 説明                                                    |
| ---------- | ---------------------------- | ---- | ------------------------------------------------------- |
| `name`     | `string`                     | ✓    | CLI プログラム名（ヘルプテキストに表示）                |
| `commands` | `Record<string, CommandDef>` | ✓    | サブコマンド定義のマップ                                |
| `onError`  | `(error: Error) => boolean`  | -    | コマンド未指定時のエラーハンドラ（`true` でヘルプ表示） |

#### 戻り値

`RoarResult<Commands>` — 判別共用体:

| プロパティ | 型              | 説明                                       |
| ---------- | --------------- | ------------------------------------------ |
| `command`  | `string`        | マッチしたコマンド名                       |
| `args`     | `string[]`      | コマンド名に続く位置引数                   |
| `flags`    | `InferFlags<F>` | コマンドのフラグ定義から推論された型付き値 |

### `CommandDef<F>`

サブコマンドの定義です。

| プロパティ | 型       | 必須 | 説明                           |
| ---------- | -------- | ---- | ------------------------------ |
| `desc`     | `string` | ✓    | コマンドの説明                 |
| `flags`    | `F`      | -    | フラグ定義。省略時はフラグなし |

### フラグ定義

各フラグは以下のプロパティを持ちます:

| プロパティ   | 型        | 対象型                              | 説明                                  |
| ------------ | --------- | ----------------------------------- | ------------------------------------- |
| `type`       | `string`  | `'string' \| 'number' \| 'boolean'` | フラグの型                            |
| `shortFlag`  | `string`  | 全型                                | 1文字のエイリアス（例: `'d'` → `-d`） |
| `desc`       | `string`  | 全型                                | ヘルプテキストに表示する説明          |
| `default`    | 型に依存  | 全型                                | デフォルト値                          |
| `isMultiple` | `boolean` | `string` / `number`                 | `true` で配列値として受け取り         |
| `isRequired` | `boolean` | `string`                            | `true` で必須フラグ                   |

### `InferFlags<F>`

フラグ定義から実行時の値の型を推論するユーティリティ型です。

## 型安全性

`parseCli` はジェネリック型を活用してコマンドごとに正確な型推論を提供します:

```typescript
const result = parseCli({
	name: 'my-tool',
	commands: {
		serve: {
			desc: 'Start server',
			flags: {
				port: { type: 'number', default: 3000 },
				host: { type: 'string', default: 'localhost' },
				open: { type: 'boolean' },
			},
		},
		build: {
			desc: 'Build project',
			flags: {
				outDir: { type: 'string', isRequired: true },
				minify: { type: 'boolean', default: false },
			},
		},
	},
	onError: () => true,
});

if (result.command === 'serve') {
	result.flags.port; // number（default があるため undefined にならない）
	result.flags.host; // string
	result.flags.open; // boolean | undefined
}

if (result.command === 'build') {
	result.flags.outDir; // string（isRequired のため undefined にならない）
	result.flags.minify; // boolean
}
```

## ライセンス

MIT
