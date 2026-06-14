# `@d-zero/google-sheets`

Google Sheets API を型安全にラップしたライブラリ。`SheetTable` で「ヘッダー定義済みのテーブル」として読み書きする。

## Installation

```sh
yarn add @d-zero/google-sheets @d-zero/google-auth
```

## Usage

```ts
import { authentication } from '@d-zero/google-auth';
import { SheetTable } from '@d-zero/google-sheets';

const auth = await authentication(null, ['https://www.googleapis.com/auth/spreadsheets']);

const table = await SheetTable.create(
	'https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit',
	'Users',
	auth,
	{
		define: {
			name: '名前',
			email: 'メールアドレス',
			age: '年齢',
			registered: '登録日',
		},
	},
);

await table.addRecords([
	{ name: '田中太郎', email: 'tanaka@example.com', age: { value: 25 } },
]);
```

書式・条件付き書式・読み取り API は `src/sheet-table.ts` の JSDoc を参照。

## 重要な制約

- **大量行のストリーミング送信は 2500 行チャンクで自動分割**される（Sheets API のメモリ・タイムアウト制約への対応）
- **遅延セル（`{ value: thunk }`）は flush 中に自動展開**される。展開中に新たな遅延セルが見つかった場合は早期 flush を停止して整合性を保つ
- **`onProgress` コールバック内で `addRecords` を再入呼びしてはならない** — buffer mutation 破壊で行順が壊れる
- **同一インスタンスへの並列呼び出し禁止** — 行順・送信件数の保証は逐次呼び出し前提

理由・実装は `src/sheet-table.ts` および `src/sheet.ts` の JSDoc を参照。
