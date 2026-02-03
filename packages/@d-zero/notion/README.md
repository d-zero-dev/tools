# @d-zero/notion

NotionデータベースをシンプルなAPIで操作するためのクライアントライブラリです。

## インストール

```bash
yarn add @d-zero/notion
```

または

```bash
npm install @d-zero/notion
```

## 概要

`@d-zero/notion`は、Notion APIを使用してデータベースからデータを取得し、テーブル形式に変換する機能を提供します。内部的に`@notionhq/client`を使用しており、シンプルで使いやすいインターフェースでNotionデータベースを操作できます。

## 主な機能

- Notionデータベースのクエリとデータ取得
- データベースの結果をテーブル形式に変換
- クライアントインスタンスのキャッシュ管理
- データベース取得結果のキャッシュ

## NotionDB クラス

### コンストラクタ

```typescript
new NotionDB(auth: string, url: string)
```

#### パラメータ

- `auth`: Notion Integration Token（APIキー）
- `url`: NotionデータベースのURL

### メソッド

#### `getDB(options?: DBOption)`

Notionデータベースのクエリ結果を取得します。一度取得した結果はキャッシュされ、2回目以降の呼び出しでは同じ結果が返されます。

**パラメータ:**

- `options` (オプショナル): データベースクエリのオプション
  - `sorts`: ソート条件の配列

**戻り値:**

- Notion APIのクエリ結果（`@notionhq/client`の`Client.dataSources.query()`の戻り値型）

#### `getTable(options?: DBOption): Promise<TableData>`

Notionデータベースをテーブル形式のデータに変換して取得します。結果はキャッシュされます。

**パラメータ:**

- `options` (オプショナル): データベースクエリのオプション
  - `sorts`: ソート条件の配列

**戻り値:**

- `Promise<TableData>`: カラム名をキー、値の配列を値とするオブジェクト

## 使用例

### 基本的な使用方法

```typescript
import { NotionDB } from '@d-zero/notion';

// NotionDBインスタンスを作成
const notionDB = new NotionDB(
	'your-notion-integration-token',
	'https://www.notion.so/your-database-id',
);

// データベースのクエリ結果を取得
const db = await notionDB.getDB();
console.log(db.results);

// テーブル形式でデータを取得
const table = await notionDB.getTable();
console.log(table);
// 出力例:
// {
//   "タイトル": ["記事1", "記事2", "記事3"],
//   "ステータス": ["公開", "下書き", "公開"],
//   "優先度": [1, 2, 3]
// }
```

### ソートオプションを使用する

```typescript
import { NotionDB } from '@d-zero/notion';

const notionDB = new NotionDB(
	'your-notion-integration-token',
	'https://www.notion.so/your-database-id',
);

// ソート条件を指定してデータを取得
const table = await notionDB.getTable({
	sorts: [
		{
			property: '優先度',
			direction: 'ascending',
		},
	],
});
```

### テーブルデータの操作

```typescript
import { NotionDB } from '@d-zero/notion';

const notionDB = new NotionDB(
	'your-notion-integration-token',
	'https://www.notion.so/your-database-id',
);

const table = await notionDB.getTable();

// 特定のカラムのデータを取得
const titles = table['タイトル'];
console.log(titles); // ["記事1", "記事2", "記事3"]

// 行単位でデータを処理
const columnNames = Object.keys(table);
const rowCount = table[columnNames[0]]?.length ?? 0;

for (let i = 0; i < rowCount; i++) {
	const row: Record<string, string | number | null> = {};
	for (const columnName of columnNames) {
		row[columnName] = table[columnName]?.[i] ?? null;
	}
	console.log(row);
}
```

## 型のエクスポート

このパッケージでは、以下の型定義をエクスポートしています。

```typescript
import type { TableData, DBOption } from '@d-zero/notion/types';
```

### TableData

```typescript
type TableData = Record<string, FieldValue[]>;
```

テーブル形式のデータを表す型です。カラム名をキー、そのカラムの値の配列を値とするオブジェクトです。

### DBOption

```typescript
type DBOption = {
	sorts?: SortOption[];
};
```

データベースクエリのオプションを指定する型です。

### FieldValue

```typescript
type FieldValue = string | number | null;
```

Notionのフィールド値として取得できる型です。現在サポートされているフィールドタイプ:

- `rich_text`: 文字列として取得
- `title`: 文字列として取得
- `number`: 数値として取得
- `select`: 選択肢の名前を文字列として取得
- その他: `null`

## 注意事項

- Notion Integration Tokenは環境変数などを使用して安全に管理してください
- データベースのクエリ結果とテーブルデータは内部的にキャッシュされます。新しいデータを取得したい場合は、新しい`NotionDB`インスタンスを作成してください
- 同じIntegration Tokenを使用する場合、Notionクライアントは自動的にキャッシュされ、再利用されます

## ライセンス

MIT
