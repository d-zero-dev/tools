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
			usage: ['<URL> [options]', '<archive> --append <URL> [options]'],
			flags: {
				depth: { type: 'number', shortFlag: 'd', desc: 'Max depth', default: 10 },
				append: {
					type: 'string',
					shortFlag: 'A',
					desc: 'Append crawl',
					valueName: 'URL',
					group: 'Crawl modes',
				},
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

## Help 表示

`--help` / `-h` は stdout に整形済みヘルプを出力して `exit(0)` する。トップレベルではコマンド一覧、コマンドの後ろではそのコマンドのフラグ一覧を表示する。

- `usage`（`string | string[]`）— `Usage:` 行の自由記述。複数指定で相互排他の起動モードを 1 行ずつ列挙できる。プログラム名とコマンド名は自動で前置される
- `valueName` — string / number フラグの値プレースホルダ（`--interval <ms>` のような表記）。省略時は `<value>` / `<n>`
- `group` — フラグをセクション見出しの下にまとめる。未指定のフラグは `Options:` 直下
- `subCommands` — help 専用のサブサブコマンドメタデータ（パースには影響しない）。コマンドの help にサブコマンド一覧を表示し、`my-tool query <file> pages --help` のようにサブコマンド名を含めるとそのサブコマンドに適用されるフラグだけに絞った help を表示する。各エントリの `flags` に適用フラグのキーを列挙し、どのエントリからも参照されないフラグは全サブコマンド共通として常に表示される

説明文は端末幅（上限 100 桁）で折り返され、ラベル列の幅はフラグ長に応じて自動調整される。

`--version`/`-v` の発火位置（`argv[0]` 限定）、空文字列 `version` の扱い、フラグ型推論の挙動は `src/parse-cli.ts` の JSDoc を参照。
