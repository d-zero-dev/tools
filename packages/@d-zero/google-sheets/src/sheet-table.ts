import type { Sheet } from './sheets/sheet.js';
import type { CellData } from './sheets/types.js';
import type { OAuth2Client } from 'google-auth-library';
import type { sheets_v4 } from 'googleapis';

import { Cell } from './sheets/cell.js';
import { Sheets } from './sheets/sheets.js';

export type HeaderCell = {
	readonly label: string;
	readonly conditionalFormatRules?: sheets_v4.Schema$ConditionalFormatRule[];
};

export type SheetTableOptions = {
	readonly frozen?: {
		readonly rows: number;
		readonly cols: number;
	};
};

export type DefineHeader<T> = {
	readonly headerRowNumber?: number;
	readonly define: Record<keyof T, string | HeaderCell>;
};

export class SheetTable<T> {
	readonly #auth: OAuth2Client;
	readonly #header: DefineHeader<T>;
	readonly #options: SheetTableOptions;
	readonly #orderedHeaderIds: (keyof T)[];
	#sheet: Sheet | null = null;
	readonly #sheetName: string;
	readonly #sheetUrl: string;

	// eslint-disable-next-line no-restricted-syntax
	private constructor(
		readonly sheetUrl: string,
		readonly sheetName: string,
		readonly auth: OAuth2Client,
		readonly header: DefineHeader<T>,
		readonly options?: SheetTableOptions,
	) {
		this.#sheetUrl = sheetUrl;
		this.#sheetName = sheetName;
		this.#auth = auth;
		this.#header = header;
		this.#options = {
			...options,
		};

		this.#orderedHeaderIds = Object.keys(this.#header.define) as (keyof T)[];
	}

	async addRecords(records: ReadonlyArray<Record<keyof T, string | CellData>>) {
		if (!this.#sheet) {
			throw new Error('Sheet is not created');
		}

		await this.#sheet.addRowData(
			records.map((record) => {
				return this.#orderedHeaderIds.map((name) => {
					const rawCellData = record[name];
					const cellData: CellData =
						typeof rawCellData === 'string' ? { value: rawCellData } : rawCellData;
					return new Cell(cellData);
				});
			}),
		);
	}

	async #create() {
		const sheets = new Sheets(this.#sheetUrl, this.#auth);
		this.#sheet = await sheets.create(this.#sheetName);

		await this.#sheet.setHeaders(
			this.#orderedHeaderIds.map((name) => {
				const headerCell = this.#header.define[name];
				return typeof headerCell === 'string' ? headerCell : headerCell.label;
			}),
		);

		for (const headerId of this.#orderedHeaderIds) {
			if (typeof headerId !== 'string') {
				continue;
			}

			const headerCell = this.#header.define[headerId];
			const headerName = typeof headerCell === 'string' ? headerCell : headerCell.label;
			if (typeof headerCell !== 'string' && headerCell.conditionalFormatRules) {
				for (const rule of headerCell.conditionalFormatRules) {
					await this.#sheet.conditionalFormat(
						[this.#sheet.getColNumByHeaderName(headerName)],
						rule,
					);
				}
			}
		}

		if (this.#options.frozen) {
			await this.#sheet.frozen(this.#options.frozen.cols, this.#options.frozen.rows);
		}
	}

	static async create<T>(
		sheetUrl: string,
		sheetName: string,
		auth: OAuth2Client,
		header: DefineHeader<T>,
		options?: SheetTableOptions,
	) {
		const table = new SheetTable<T>(sheetUrl, sheetName, auth, header, options);
		await table.#create();
		return table;
	}
}
