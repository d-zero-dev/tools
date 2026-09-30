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

### Drive フォルダ URL から新規作成

`createSpreadsheet` は Drive フォルダ URL を受け取り、そのフォルダ内にスプレッドシートを新規作成する。`parseGoogleUrl` で URL 種別を判別すれば、「フォルダ URL なら新規作成、スプレッドシート URL なら既存に書き込み」と分岐できる。フォルダ URL は `https://drive.google.com/drive/folders/<id>` 形式のみ受理する（`open?id=` はフォルダとファイルを URL から区別できないため非対応）。

```ts
import { authentication } from '@d-zero/google-auth';
import { createSpreadsheet, parseGoogleUrl, Sheets } from '@d-zero/google-sheets';

// Drive scope が必要（spreadsheets scope だけではフォルダに配置できない）
const auth = await authentication(null, [
	'https://www.googleapis.com/auth/spreadsheets',
	'https://www.googleapis.com/auth/drive.file',
]);

const target = parseGoogleUrl(input);
const sheetUrl =
	target?.kind === 'drive-folder'
		? (await createSpreadsheet(input, '集計結果', auth)).url
		: input;

const sheets = new Sheets(sheetUrl, auth);
```

書式・条件付き書式・読み取り API は `src/sheet-table.ts` の JSDoc を参照。

## 重要な制約

- **大量行のストリーミング送信は 2500 行チャンクで自動分割**される（Sheets API のメモリ・タイムアウト制約への対応）
- **遅延セル（`{ value: thunk }`）は flush 中に自動展開**される。展開中に新たな遅延セルが見つかった場合は早期 flush を停止して整合性を保つ
- **`onProgress` コールバック内で `addRecords` を再入呼びしてはならない** — buffer mutation 破壊で行順が壊れる
- **`createSpreadsheet` はリトライしない・同名ファイルを検索しない** — `files.create` は非冪等で、リトライすると二重作成し得るため。呼ぶたびに新規作成する
- **同一インスタンスへの並列呼び出し禁止** — 行順・送信件数の保証は逐次呼び出し前提

理由・実装は `src/sheet-table.ts` および `src/sheet.ts` の JSDoc を参照。
