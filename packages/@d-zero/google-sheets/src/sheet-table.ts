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
	readonly bodyStartRow?: number;
	readonly frozen?: {
		readonly rows: number;
		readonly cols: number;
	};
};

export type SearchTableHeaders<T> = {
	readonly headerRowNumber?: number;
	readonly search: readonly (keyof T)[];
};

export type DefineHeader<T> = {
	readonly headerRowNumber?: number;
	readonly define: Record<keyof T, string | HeaderCell>;
};

export class SheetTable<T> {
	readonly #auth: OAuth2Client;
	readonly #bodyStartRow: number;
	readonly #header: DefineHeader<T> | SearchTableHeaders<T>;
	readonly #options: SheetTableOptions;
	readonly #orderedHeaderIds: readonly (keyof T)[];
	#sheet: Sheet | null = null;
	readonly #sheetName: string;
	readonly #sheetUrl: string;

	// eslint-disable-next-line no-restricted-syntax
	private constructor(
		readonly sheetUrl: string,
		readonly sheetName: string,
		readonly auth: OAuth2Client,
		readonly header: DefineHeader<T> | SearchTableHeaders<T>,
		readonly options?: SheetTableOptions,
	) {
		this.#sheetUrl = sheetUrl;
		this.#sheetName = sheetName;
		this.#auth = auth;
		this.#header = header;
		this.#options = {
			...options,
		};

		if ('define' in this.#header) {
			this.#orderedHeaderIds = Object.keys(this.#header.define) as (keyof T)[];
		} else {
			this.#orderedHeaderIds = this.#header.search;
		}

		this.#bodyStartRow = options?.bodyStartRow ?? 2;
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

	async getData() {
		if (!this.#sheet) {
			throw new Error('Sheet is not created');
		}

		const headers = await getHeaders(
			this.#sheet,
			this.#header.headerRowNumber ?? 1,
			this.#orderedHeaderIds,
		);

		const data = await this.#sheet.getValues(
			`${headers.at(0)?.row ?? 'A'}${this.#bodyStartRow}`,
			headers.at(-1)?.row ?? 'A',
		);

		if (data == null) {
			return [];
		}

		const list = data.map((_d) => {
			const _data: Partial<T> = {};

			for (const header of headers) {
				_data[header.key] = _d[header.index - (headers.at(0)?.index ?? 0)];
			}

			return _data as T;
		});

		return list;
	}

	async #create() {
		const sheets = new Sheets(this.#sheetUrl, this.#auth);
		this.#sheet = await sheets.create(this.#sheetName);

		if ('define' in this.#header) {
			await this.#sheet.setHeaders(
				this.#orderedHeaderIds.map((name) => {
					if (!('define' in this.#header)) {
						throw new Error('Header is not defined');
					}
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
		}

		if (this.#options.frozen) {
			await this.#sheet.frozen(this.#options.frozen.cols, this.#options.frozen.rows);
		}
	}

	static async create<T>(
		sheetUrl: string,
		sheetName: string,
		auth: OAuth2Client,
		header: DefineHeader<T> | SearchTableHeaders<T>,
		options?: SheetTableOptions,
	) {
		const table = new SheetTable<T>(sheetUrl, sheetName, auth, header, options);
		await table.#create();
		return table;
	}
}

interface Header<T> {
	key: keyof T;
	row: string;
	index: number;
}

/**
 *
 * @param sheet
 * @param headerRowNumber
 * @param keys
 */
async function getHeaders<T>(
	sheet: Sheet,
	headerRowNumber: number,
	keys: readonly (keyof T)[],
) {
	const headerCells = await sheet.getValues(`${headerRowNumber}`, `${headerRowNumber}`);
	return keys
		.map<Header<T> | null>((key) => {
			const index = headerCells?.[0]?.indexOf(key);
			if (index == null || index === -1) {
				return null;
			}
			return {
				key,
				row: getClmName(index + 1),
				index,
			};
		})
		.filter((header) => header != null)
		.toSorted((a, b) => a.index - b.index);
}

/**
 * Convert column number to alphabet column name.
 * Example: 5 => "E", 100 => "CV"
 * @param col
 */
function getClmName(col: number): string {
	const COUNT_OF_ALPHABET = 26;
	const CODE_POINT_A = 'A'.codePointAt(0)!;
	if (Number.isNaN(col)) {
		throw new TypeError(`col is not a number. col: ${col}`);
	}
	let div = Math.floor(col / COUNT_OF_ALPHABET);
	let mod = col % COUNT_OF_ALPHABET;
	if (mod === 0) {
		div--;
		mod = COUNT_OF_ALPHABET;
	}
	const parent =
		div > COUNT_OF_ALPHABET
			? getClmName(div)
			: div > 0
				? String.fromCodePoint(CODE_POINT_A + div - 1)
				: '';
	const child = String.fromCodePoint(CODE_POINT_A + mod - 1);
	return parent + child;
}
