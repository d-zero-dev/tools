import type { DBOption, TableData } from './types.js';
import type { Client } from '@notionhq/client';

import { createClient } from './client.js';
import { getNotionIdByURL } from './get-notion-id-by-url.js';
import { getValueByField } from './get-value-by-field.js';

type QueryDatabaseResponse = Awaited<ReturnType<Client['dataSources']['query']>>;

/**
 * Notion データベースを取得し、テーブル形式に変換するクライアント。
 *
 * `getDB` / `getTable` は一度取得した結果をインスタンス内にキャッシュし、
 * 同一インスタンスに対する 2 回目以降の呼び出しでは API を叩かない。
 * クエリ条件（`options.sorts`）はキャッシュキーとしては扱わないため、
 * **異なる条件で取得し直したい場合は新しいインスタンスを作る**こと。
 * Notion API は read レート制限が厳しめなので、不要な再取得を避けるための既定動作。
 */
export class NotionDB {
	#client: Client;
	#db: QueryDatabaseResponse | null = null;
	#dbId: string;

	#table: TableData | null = null;

	constructor(auth: string, url: string) {
		this.#client = createClient(auth);
		this.#dbId = getNotionIdByURL(url);
	}

	async getDB(options?: DBOption) {
		if (this.#db) {
			return this.#db;
		}
		const db = await this.#client.dataSources.query({
			data_source_id: this.#dbId,
			sorts: options?.sorts,
		});
		this.#db = db;
		return db;
	}

	async getTable(options?: DBOption) {
		if (this.#table) {
			return this.#table;
		}
		const db = await this.getDB(options);
		const table: TableData = {};

		for (const [index, page] of db.results.entries()) {
			if (page.object === 'page' && 'properties' in page) {
				const keys = Object.keys(page.properties);
				for (const key of keys) {
					if (!(key in table)) {
						table[key] = [];
					}
				}

				for (const [key, field] of Object.entries(page.properties)) {
					const column = table[key];
					if (!column) {
						continue;
					}
					column[index] = getValueByField(field);
				}
			}
		}

		this.#table = table;
		return table;
	}
}
