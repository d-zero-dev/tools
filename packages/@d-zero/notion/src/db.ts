import type { DBOption, TableData } from './types.js';
import type { Client } from '@notionhq/client';
import type { QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints.js';

import { createClient } from './client.js';
import { getNotionIdByURL } from './get-notion-id-by-url.js';
import { getValueByField } from './get-value-by-field.js';

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
		const db = await this.#client.databases.query({
			database_id: this.#dbId,
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
