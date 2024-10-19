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

export class SheetTable<T> {
	readonly #auth: OAuth2Client;
	readonly #header: Record<keyof T, string | HeaderCell>;
	readonly #options: SheetTableOptions;
	readonly #sheetName: string;
	readonly #sheetUrl: string;

	constructor(
		readonly sheetUrl: string,
		readonly sheetName: string,
		readonly auth: OAuth2Client,
		readonly header: Record<keyof T, string | HeaderCell>,
		readonly options?: SheetTableOptions,
	) {
		this.#sheetUrl = sheetUrl;
		this.#sheetName = sheetName;
		this.#auth = auth;
		this.#header = header;
		this.#options = {
			...options,
		};
	}

	async update(data: ReadonlyArray<Record<keyof T, string | CellData>>) {
		const sheets = new Sheets(this.#sheetUrl, this.#auth);

		const sheet = await sheets.create(this.#sheetName);

		const orderedHeaderIds = Object.keys(this.#header) as (keyof T)[];

		await sheet.setHeaders(
			orderedHeaderIds.map((name) => {
				const headerCell = this.#header[name];
				return typeof headerCell === 'string' ? headerCell : headerCell.label;
			}),
		);

		await sheet.addRowData(
			data.map((row) => {
				return orderedHeaderIds.map((name) => {
					const rawCellData = row[name];
					const cellData: CellData =
						typeof rawCellData === 'string' ? { value: rawCellData } : rawCellData;
					return new Cell(cellData);
				});
			}),
		);

		if (this.#options.frozen) {
			await sheet.frozen(this.#options.frozen.cols, this.#options.frozen.rows);
		}

		for (const headerId of orderedHeaderIds) {
			if (typeof headerId !== 'string') {
				continue;
			}
			const headerCell = this.#header[headerId];
			const headerName = typeof headerCell === 'string' ? headerCell : headerCell.label;
			if (typeof headerCell !== 'string' && headerCell.conditionalFormatRules) {
				for (const rule of headerCell.conditionalFormatRules) {
					await sheet.conditionalFormat([sheet.getColNumByHeaderName(headerName)], rule);
				}
			}
		}
	}
}
