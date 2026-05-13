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
- **自動バージョン表示** — `version` 設定時、トップレベルの `--version` / `-v` でバージョンを出力
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

### 位置引数とフラグの併用

フラグと位置引数（positional args）は任意の順序で混在できます。boolean フラグの直後に位置引数を置いても正しくパースされます。

```bash
# フラグと位置引数の順序は自由
my-tool crawl https://example.com --verbose
my-tool crawl --verbose https://example.com
# => result.args: ['https://example.com'], result.flags.verbose: true

# 複数のフラグ・位置引数も混在可能
my-tool crawl --verbose --depth 5 https://example.com https://test.com
# => result.args: ['https://example.com', 'https://test.com']

# `--` 以降はすべて位置引数として扱われる
my-tool crawl --verbose -- --not-a-flag
# => result.args: ['--not-a-flag']
```

### バージョン表示

`version` を設定すると、トップレベルで `--version` または `-v` が渡されたときに自動的にバージョンを `console.log` で出力し、`process.exit(0)` します。

```typescript
import pkg from '../package.json' with { type: 'json' };

const result = parseCli({
	name: 'my-tool',
	version: pkg.version,
	commands: {
		build: { desc: 'Build the project' },
	},
	onError: () => true,
});
```

```bash
my-tool --version
# => 1.2.3

my-tool -v
# => 1.2.3
```

**仕様の詳細:**

- 判定は **`argv[0]`（コマンド名の位置）のみ** で行います。`my-tool build -v` のようにサブコマンドの後ろに付けた場合は、そのコマンドが定義した `shortFlag: 'v'` のフラグとして解釈され、バージョン表示は発火しません。
- `version` を設定しなかった場合、`-v` / `--version` は通常の不明コマンドとして扱われ、`onError` が呼ばれて `process.exit(1)` します。
- `version` に空文字列 `''` を設定した場合も「version が指定された」と扱い、空行を出力して `exit(0)` します（`undefined` のみが「version 未指定」を意味します）。

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

| プロパティ | 型                           | 必須 | 説明                                                                          |
| ---------- | ---------------------------- | ---- | ----------------------------------------------------------------------------- |
| `name`     | `string`                     | ✓    | CLI プログラム名（ヘルプテキストに表示）                                      |
| `version`  | `string`                     | -    | プログラムのバージョン文字列。指定すると `--version` / `-v` で自動表示&exit 0 |
| `commands` | `Record<string, CommandDef>` | ✓    | サブコマンド定義のマップ                                                      |
| `onError`  | `(error: Error) => boolean`  | -    | コマンド未指定・不明時のエラーハンドラ（`true` でヘルプ表示）                 |

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
