# `@d-zero/google-sheets`

Google Sheets API を使いやすくラップした TypeScript ライブラリです。型安全なテーブル操作を提供します。

## インストール

```bash
npm install @d-zero/google-sheets @d-zero/google-auth
```

## 基本的な使い方

### 認証

```typescript
import { authentication } from '@d-zero/google-auth';

// クレデンシャルファイルのパスを直接指定
const auth = await authentication('path/to/credentials.json', [
	'https://www.googleapis.com/auth/spreadsheets',
]);

// または環境変数GOOGLE_AUTH_CREDENTIALSから自動取得
const auth = await authentication(null, ['https://www.googleapis.com/auth/spreadsheets']);
```

認証の詳細は [@d-zero/google-auth](../google-auth/README.md) を参照してください。

### データを書き込む

```typescript
import { SheetTable } from '@d-zero/google-sheets';

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
	{
		name: '田中太郎',
		email: 'tanaka@example.com',
		age: { value: 25 },
		registered: { value: new Date('2024-01-15') },
	},
]);
```

### データを読み取る

```typescript
const table = await SheetTable.create(
	'https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit',
	'Products',
	auth,
	{
		search: ['id', 'name', 'price', 'inStock'],
	},
);

const products = await table.getData();
```

### セルのスタイリング

文字列の代わりにオブジェクトを渡すことで、セルの書式を指定できます。

```typescript
await table.addRecords([
	{
		title: 'プロジェクトA',
		link: {
			value: 'https://example.com',
			textFormat: {
				link: { uri: 'https://example.com' },
				foregroundColor: { blue: 1.0 },
			},
		},
		status: {
			value: '完了',
			textFormat: {
				bold: true,
				foregroundColor: { green: 0.8 },
			},
		},
	},
]);
```

### 条件付き書式

ヘッダー定義時に条件付き書式を設定できます。

```typescript
const table = await SheetTable.create(spreadsheetUrl, 'Sales', auth, {
	define: {
		date: '日付',
		amount: {
			label: '売上金額',
			conditionalFormatRules: [
				{
					booleanRule: {
						condition: {
							type: 'NUMBER_GREATER_THAN_EQ',
							values: [{ userEnteredValue: '10000' }],
						},
						format: {
							backgroundColor: { red: 0.8, green: 1.0, blue: 0.8 },
						},
					},
				},
			],
		},
		status: 'ステータス',
	},
});
```

## API リファレンス

### `SheetTable`

#### 静的メソッド

##### `SheetTable.create(sheetUrl, sheetName, auth, header, options?)`

テーブルを作成します。シートが存在しない場合は作成されます。

**パラメータ:**

- `sheetUrl: string` - スプレッドシートの URL
- `sheetName: string` - シート名
- `auth: OAuth2Client` - 認証クライアント
- `header` - ヘッダー設定
  - `{ define: { [key: string]: string | HeaderCell } }` - ヘッダーを定義する
  - `{ search: string[] }` - 既存のヘッダーを検索する
- `options?` - オプション設定
  - `bodyStartRow?: number` - データ開始行（デフォルト: 2）
  - `frozen?: { rows: number; cols: number }` - 固定する行・列数

**戻り値:** `Promise<SheetTable>`

#### インスタンスメソッド

##### `addRecords(records)`

レコードを追加します。

**パラメータ:**

- `records` - レコードの配列。各値は `string` または `{ value, textFormat?, cellFormat?, ... }` オブジェクト（文字列以外の値も `{ value: ... }` でラップ）

##### `getData()`

すべてのデータを取得します。セルの型（文字列、数値、日付など）は自動変換されます。

**戻り値:** `Promise<T[]>`

### 型定義

#### `HeaderCell`

```typescript
type HeaderCell = {
	readonly label: string;
	readonly conditionalFormatRules?: sheets_v4.Schema$ConditionalFormatRule[];
};
```

#### `CellData`

```typescript
type CellData<T = CellRawData> = {
	readonly value: T;
	readonly textFormat?: sheets_v4.Schema$TextFormat | null;
	readonly cellFormat?: sheets_v4.Schema$CellFormat | null;
	readonly image?: boolean;
	readonly note?: string;
	readonly ifNull?: T;
};
```

#### `CellRawData`

```typescript
type CellRawData = string | number | boolean | Date | null | undefined;
```

#### `Row`

```typescript
type Row = readonly Cell[];
```

#### `CellType`

```typescript
type CellType = 'string' | 'number' | 'boolean' | 'date' | 'formula' | 'error';
```

#### `CellTypeInfo`

```typescript
type CellTypeInfo = {
	readonly index: number;
	readonly type: CellType;
};
```

**`textFormat` の主なプロパティ:**

- `bold?: boolean` - 太字
- `italic?: boolean` - 斜体
- `foregroundColor?: { red?: number; green?: number; blue?: number }` - 文字色（0.0-1.0）
- `link?: { uri: string }` - ハイパーリンク

詳細は [Google Sheets API リファレンス](https://developers.google.com/sheets/api/reference/rest) を参照してください。

### 低レベル API

`SheetTable` を使わず、より細かい制御が必要な場合は `Sheets` クラスを直接使用できます。

```typescript
import { Sheets } from '@d-zero/google-sheets';

const sheets = new Sheets(sheetUrl, auth);
const sheet = await sheets.create('SheetName');
// sheet.addRowData(), sheet.setHeaders() など
```

詳細は [ソースコード](./src) を参照してください。

### 大量行のストリーミング送信 (`appendRow` / `flush`)

数万行クラスのデータを `addRowData(rows[])` で一括渡しすると、API リクエスト本文の gzip 圧縮中に呼び出し元のヒープを圧迫する場合があります。`Sheet` は行を逐次積む API を提供しており、内部で控えめなチャンク（既定 2500 行）に区切って自動送信します。

```typescript
const sheet = await sheets.create('Large Data');
await sheet.setHeaders(['URL', 'Title']);

for (const page of pages) {
	const rows = generateRows(page);
	await sheet.appendRow(...rows); // 可変長。配列はスプレッドで渡す
}
await sheet.flush(); // 末尾の未送信分を排出
```

#### 動作仕様

- `appendRow(...rows)` は内部バッファに行を積み、2500 行に達した時点で先頭から `addRowData()` 経由で送信する
- `flush()` は未送信分を全て送り切る。空バッファでの呼び出しは no-op、連続呼び出しも冪等
- `sheet.sentCount` getter で累計送信行数を取得できる（進捗表示用途）

#### 遅延セルの自動検出

`createCellData(() => ({...}))` で生成された thunk セルが行に 1 つでも含まれると、`appendRow` はその時点で自動 flush を停止し、明示的な `flush()` 呼び出しまで全行をバッファに保持します。これは thunk が呼び出し元の共有状態を `provide()` 評価時に参照するためで、ストリーミングで早期送信すると thunk がまだ確定していない時点で実行され、結果が壊れるのを防ぎます。FIFO 順を保つため、遅延行が一度入ったあとは後続の eager 行も同じくバッファに留まります。

#### 同時実行の制約

`appendRow` / `flush` は同一 `Sheet` インスタンスに対して **逐次** に呼ぶ前提です（`await` で完了を待ってから次を呼ぶ）。`Promise.all` 等で並行に呼ぶと内部バッファの mutation がインターリーブし、行順や送信件数が壊れる可能性があります。シート単位で並列処理したい場合はインスタンスを分離してください。

## ライセンス

MIT
