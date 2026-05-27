# マイグレーションガイド: ページフック API の整合化

## サマリー

ページフック（`hooks` オプション）の受け渡し方法を 4 つのパッケージで統一しました。

| パッケージ                    | 影響範囲                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@d-zero/print`               | **破壊的変更**: ライブラリ API `print({ hooks })` の型が変更                                                                                                        |
| `@d-zero/archaeologist`       | **破壊的変更**: ライブラリ API `analyze({ hooks })` / `freeze({ hooks })` の型が変更。CLI 経由では以前 hooks が無視されていたものが動くようになります               |
| `@d-zero/a11y-check-core`     | **破壊的変更**: ライブラリ API `scenarioRunner(..., { hooks })` の型が変更。CLI 経由（`@d-zero/a11y-check`）では以前 hooks が無視されていたものが動くようになります |
| `@d-zero/a11y-check`          | 内部の `readConfig` 戻り値の型が変更（公開 API ではない）                                                                                                           |
| `@d-zero/puppeteer-page-scan` | 公開型 `PageHookSource` を追加（後方互換あり）                                                                                                                      |

CLI 経由の利用者（`-f url-list.txt` の `hooks:` 設定）は **書き方を変える必要はありません**。フックファイル自体の書き方 (`export default async function (page, ctx) { ... }`) も変わりません。

ただし `@d-zero/archaeologist` と `@d-zero/a11y-check` を CLI から使っていた利用者で、設定ファイルに `hooks:` を書いていた場合、**以前は無視されていたフックが本リリース以降は実行されるようになる** ため、フックスクリプトの内容を再確認してください。

## なぜ変更したか

`@d-zero/print` などの CLI ツールは Puppeteer を子プロセス（fork）で動かしており、親プロセスから子プロセスへ設定を IPC（`process.send`）で渡します。Node の IPC は内部的に JSON シリアライズを使うため、**関数オブジェクトは `null` に変換されて消失**します。

旧 API では `hooks: PageHook[]`（関数配列）を子プロセスへ送ろうとしていましたが、IPC を越えた瞬間に `[null, null, ...]` になり、子プロセス側で `TypeError: hook is not a function` が発生していました。

新 API では「外側はパス記述、内側で関数化」する設計に統一しました:

- 親プロセス: フックファイルのパス（文字列）を `PageHookSource = { paths, baseDir }` として子プロセスへ送信
- 子プロセス: 受け取った `PageHookSource` から `readPageHooks(paths, baseDir)` で関数配列を生成

これにより IPC 越境の物理制約と API の型が一致し、フックが確実に動作します。

詳細は [ARCHITECTURE.md](./ARCHITECTURE.md#crossing-ipc-boundaries-pagehooksource) を参照してください。

## 影響を受ける API

### `@d-zero/print`

```ts
import type { PrintOptions } from '@d-zero/print';

// 旧
interface PrintOptions {
	readonly hooks?: readonly PageHook[];
	// ...
}

// 新
interface PrintOptions {
	readonly hooks?: PageHookSource;
	// ...
}
```

### `@d-zero/archaeologist`

```ts
import type { AnalyzeOptions, FreezeOptions } from '@d-zero/archaeologist';

// 旧
interface GeneralOptions {
	readonly hooks: readonly PageHook[]; // 必須
}

// 新
interface GeneralOptions {
	readonly hooks?: PageHookSource; // optional
}
```

加えて `analyze-child-process` / `freeze-child-process` の内部で `getData` に `hooks` を渡すようになりました（旧版では渡されておらず、結果的に CLI の `hooks:` 設定が無視されていました）。

### `@d-zero/a11y-check-core`

```ts
import type { ScenarioRunnerOptions } from '@d-zero/a11y-check-core';

// 旧
type ScenarioRunnerOptions = DealOptions & {
	readonly hooks?: readonly PageHook[];
};

// 新
type ScenarioRunnerOptions = DealOptions & {
	readonly hooks?: PageHookSource;
};
```

加えて `scenario-child-process` の内部で `beforePageScan` に `hooks` を渡すようになりました（旧版では渡されておらず、CLI の `hooks:` 設定が無視されていました）。

### `@d-zero/puppeteer-page-scan`

新規型を追加（後方互換）:

```ts
export type PageHookSource = {
	readonly paths: readonly string[]; // フックファイルのパス（絶対 or 相対）
	readonly baseDir: string; // 相対パスを解決する基準ディレクトリ
};
```

既存の `PageHook`、`readPageHooks`、`beforePageScan` のシグネチャは変更ありません。

## 書き換え例（ライブラリ利用者向け）

### `@d-zero/print`

```ts
import { print } from '@d-zero/print';

// 旧
await print(['https://example.com'], {
	type: 'png',
	hooks: [
		async (page, ctx) => {
			await page.type('#username', 'user');
			// ...
		},
	],
});

// 新: hook をファイルに分離して、パスを渡す
// ./hooks/login.mjs
export default async function (page, ctx) {
	await page.type('#username', 'user');
	// ...
}
```

```ts
await print(['https://example.com'], {
	type: 'png',
	hooks: {
		paths: ['./hooks/login.mjs'],
		baseDir: process.cwd(),
	},
});
```

### `@d-zero/archaeologist`

```ts
import { archaeologist } from '@d-zero/archaeologist';

// 旧（実際には IPC で関数が失われ動作していなかった）
await archaeologist(pairList, {
	hooks: [
		async (page, ctx) => {
			/* ... */
		},
	],
});

// 新
await archaeologist(pairList, {
	hooks: {
		paths: ['./hooks/login.mjs'],
		baseDir: process.cwd(),
	},
});
```

### `@d-zero/a11y-check-core`

```ts
import { scenarioRunner } from '@d-zero/a11y-check-core';

// 旧
await scenarioRunner(urlList, scenarios, {
	hooks: [
		async (page, ctx) => {
			/* ... */
		},
	],
});

// 新
await scenarioRunner(urlList, scenarios, {
	hooks: {
		paths: ['./hooks/login.mjs'],
		baseDir: process.cwd(),
	},
});
```

## 書き換え不要のケース

### CLI 利用 (`-f url-list.txt`)

フロントマターの書き方は変更ありません。

```yaml
---
hooks:
  - ./hooks/login.mjs
---
https://example.com
```

ただし `@d-zero/archaeologist` および `@d-zero/a11y-check` の利用者は以下に注意してください:

- **旧バージョンでは設定ファイルの `hooks` が無視されていました**
- 本リリース以降は記述通りに実行されます
- 動作確認後にデプロイしてください

### フックスクリプト本体

`export default async function (page, ctx) { ... }` の書き方は変更ありません。

## 検証方法

1. パッケージを更新:

   ```sh
   yarn upgrade @d-zero/print@latest @d-zero/archaeologist@latest @d-zero/a11y-check@latest
   ```

2. TypeScript プロジェクトでは `tsc --noEmit` を実行し、`hooks` プロパティの型不一致が出ないか確認

3. CLI 利用者は debug モードでフックが実行されているかログを確認:

   ```sh
   npx @d-zero/print -f urls.txt --verbose --debug
   ```

   `serialize function:` / `deserialize function:` のログが出ていないことを確認（`PageHookSource` を使えば出ません。出ていれば旧 API の経路が残っています）

## 参考リンク

- [ARCHITECTURE.md — Crossing IPC boundaries](./ARCHITECTURE.md#crossing-ipc-boundaries-pagehooksource)
- [`@d-zero/puppeteer-page-scan` README — PageHookSource](./packages/@d-zero/puppeteer-page-scan/README.md#pagehooksource)
- [回帰テスト: `proc-talk` の serialize](./packages/@d-zero/proc-talk/src/serialize.spec.ts)
- 参考: Node.js IPC の挙動について検索する場合は `"process.send" function null` などのキーワードが有効
