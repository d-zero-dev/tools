import type { Sheet } from './sheets/sheet.js';
import type { CellData, CellType } from './sheets/types.js';
import type { OAuth2Client } from 'google-auth-library';
import type { sheets_v4 } from 'googleapis';

import { Cell } from './sheets/cell.js';
import { Sheets } from './sheets/sheets.js';

// Google Sheets epoch (December 30, 1899)
const SHEETS_EPOCH = new Date(1899, 11, 30).getTime();

/**
 * Configuration for a single header column in a sheet table.
 */
export type HeaderCell = {
	readonly label: string;
	readonly conditionalFormatRules?: sheets_v4.Schema$ConditionalFormatRule[];
};

/**
 * Options for creating a {@link SheetTable}.
 */
export type SheetTableOptions = {
	readonly bodyStartRow?: number;
	readonly frozen?: {
		readonly rows: number;
		readonly cols: number;
	};
};

/**
 * Header configuration that searches for existing header labels in the sheet.
 * @template T - Record type whose keys correspond to header labels in the sheet
 */
export type SearchTableHeaders<T> = {
	readonly headerRowNumber?: number;
	readonly search: readonly (keyof T)[];
};

/**
 * Header configuration that explicitly defines column headers and their labels.
 * @template T - Record type whose keys are used as header identifiers
 */
export type DefineHeader<T> = {
	readonly headerRowNumber?: number;
	readonly define: Record<keyof T, string | HeaderCell>;
};

/**
 * Typed table interface for reading from and writing to a Google Sheets worksheet.
 *
 * Use the static {@link SheetTable.create} factory method to instantiate.
 * @template T - Record type representing a single row of data
 */
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

	/**
	 * Appends rows to the sheet.
	 * @param records - Array of row data keyed by header identifiers
	 */
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

	/**
	 * Retrieves all data rows with header-mapped values and row visibility state.
	 *
	 * Each returned record includes:
	 * - `hiddenByUser` (`boolean`): `true` if the row is manually hidden by a user
	 * - `hiddenByFilter` (`boolean`): `true` if the row is hidden by a filter view
	 * @returns Array of records typed as `T & { hiddenByUser: boolean; hiddenByFilter: boolean }`
	 */
	async getData() {
		if (!this.#sheet) {
			throw new Error('Sheet is not created');
		}

		const headers = await getHeaders(
			this.#sheet,
			this.#header.headerRowNumber ?? 1,
			this.#orderedHeaderIds,
		);

		if (headers.length === 0) {
			return [];
		}

		const firstColIndex = headers.at(0)?.index ?? 0;

		// Get type information from the first data row
		const firstDataRowRange = `${headers.at(0)?.row ?? 'A'}${this.#bodyStartRow}:${headers.at(-1)?.row ?? 'A'}${this.#bodyStartRow}`;
		const cellTypes = await this.#sheet.getCellTypes(firstDataRowRange);

		// Convert type information to Map (managed by absolute index)
		const typeMap = new Map<number, CellType>();
		for (const cellType of cellTypes) {
			// cellType.index is relative position (0-based), so add firstColIndex to convert to absolute position
			typeMap.set(firstColIndex + cellType.index, cellType.type);
		}

		// Get all data and row metadata in parallel
		const [data, rowMetadata] = await Promise.all([
			this.#sheet.getValues(
				`${headers.at(0)?.row ?? 'A'}${this.#bodyStartRow}`,
				headers.at(-1)?.row ?? 'A',
			),
			this.#sheet.getRowMetadata(this.#bodyStartRow),
		]);

		if (data == null) {
			return [];
		}

		const list = data.map((_d, rowIndex) => {
			const meta = rowMetadata[rowIndex];
			const _data: Partial<T> = {};

			for (const header of headers) {
				const relativeIndex = header.index - firstColIndex;
				const rawValue = _d[relativeIndex];
				const cellType = typeMap.get(header.index) ?? 'string';

				_data[header.key] = convertValue(rawValue, cellType) as T[keyof T];
			}

			return {
				..._data,
				hiddenByUser: meta?.hiddenByUser ?? false,
				hiddenByFilter: meta?.hiddenByFilter ?? false,
			} as T & { hiddenByUser: boolean; hiddenByFilter: boolean };
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

	/**
	 * Creates and initializes a new {@link SheetTable} instance.
	 * @template T - Record type representing a single row of data
	 * @param sheetUrl - Full URL of the Google Spreadsheet
	 * @param sheetName - Name of the worksheet tab to operate on
	 * @param auth - Authenticated OAuth2 client for Google Sheets API access
	 * @param header - Header configuration (define columns explicitly or search existing ones)
	 * @param options - Additional table options such as frozen panes and body start row
	 * @returns Initialized SheetTable instance ready for read/write operations
	 */
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
 * Resolves header keys to their column positions by reading the header row from the sheet.
 * @param sheet - Sheet instance to read headers from
 * @param headerRowNumber - 1-based row number where headers are located
 * @param keys - Header keys to search for in the header row
 * @returns Resolved headers sorted by column index, excluding keys not found
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
 * Converts a 1-based column number to an alphabetic column name (e.g. 5 → "E", 100 → "CV").
 * @param col - 1-based column number
 * @returns Alphabetic column name
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

/**
 * Convert raw cell value to appropriate type
 * @param rawValue - The raw value from the cell (typically string or any)
 * @param cellType - The detected cell type
 * @returns Converted value in appropriate type
 */
function convertValue(
	rawValue: unknown,
	cellType: CellType,
): string | number | boolean | Date | null {
	// Handle null/undefined
	if (rawValue == null || rawValue === '') {
		return null;
	}

	switch (cellType) {
		case 'number': {
			const num = Number(rawValue);
			return Number.isNaN(num) ? null : num;
		}
		case 'boolean': {
			if (typeof rawValue === 'boolean') {
				return rawValue;
			}
			if (typeof rawValue === 'string') {
				const lower = rawValue.toLowerCase();
				if (lower === 'true' || lower === 'yes' || lower === '1') {
					return true;
				}
				if (lower === 'false' || lower === 'no' || lower === '0') {
					return false;
				}
			}
			return Boolean(rawValue);
		}
		case 'date': {
			// Google Sheets dates are returned as serial values (numbers)
			const serialValue = Number(rawValue);
			if (Number.isNaN(serialValue)) {
				return null;
			}
			// Convert serial value to Date
			const date = new Date(SHEETS_EPOCH + serialValue * 86_400_000);
			return date;
		}
		case 'formula': {
			// For formulas, return the evaluated result as a string
			return String(rawValue);
		}
		case 'error': {
			// Return null for error values
			return null;
		}
		case 'string': {
			return String(rawValue);
		}
		default: {
			return String(rawValue);
		}
	}
}
