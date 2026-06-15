# `@d-zero/notion`

Notion データベースを取得・テーブル化するクライアントライブラリ。`@notionhq/client` ベース。

## Installation

```sh
yarn add @d-zero/notion
```

## Usage

```ts
import { NotionDB } from '@d-zero/notion';

const notionDB = new NotionDB(token, 'https://www.notion.so/your-database-id');

const table = await notionDB.getTable({
	sorts: [{ property: 'title', direction: 'ascending' }],
});
```

`getDB` / `getTable` は同一クエリ結果をインスタンス内でキャッシュする（**再取得したい場合は新しいインスタンスを作る**）。理由・実装は `src/notion-db.ts` の JSDoc を参照。
