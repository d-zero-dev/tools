import type { Sheets } from './sheets.js';
import type { Row } from './types.js';
import type { sheets_v4 } from 'googleapis';

import { splitArray } from '@d-zero/shared/split-array';
import { GaxiosError } from 'gaxios';

import { log } from '../debug.js';

import { Cell } from './cell.js';

const NUMBER_OF_PAGE_INFO_PER_ONE_REQUEST = 100_000;

const sheetLog = log.extend('Sheet');
const sendLog = sheetLog.extend('Send');

export class Sheet {
	#currentColIndex = 1;
	#currentRowIndex = 0;
	#headers: readonly string[] | null = null;
	readonly #parent: Sheets;

	readonly #sheet: sheets_v4.Schema$Sheet;

	get id() {
		const id = this.props.sheetId;
		if (id == null) {
			throw new Error("Sheet doesn't have sheet ID ");
		}
		return id;
	}

	get props() {
		const props = this.#sheet.properties;
		if (!props) {
			throw new Error("Sheet doesn't have properties");
		}
		return props;
	}

	constructor(sheet: sheets_v4.Schema$Sheet, parent: Sheets) {
		this.#sheet = sheet;
		this.#parent = parent;
	}

	async addRowData(data: Row[], next = true) {
		const total = data.length;
		sheetLog('Will add %d items', total);
		if (!next) {
			this.#currentRowIndex = 0;
		}
		let numOfReq = NUMBER_OF_PAGE_INFO_PER_ONE_REQUEST;
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const success = await this.#addRowQueue(data, numOfReq).catch((error) => {
				if (error instanceof RangeError) {
					return error;
				}
				throw error;
			});
			if (success instanceof RangeError) {
				const dec = numOfReq / 2;
				sheetLog('Decrement request %d to %d', numOfReq, dec);
				numOfReq = dec;
				continue;
			}
			if (success) {
				return;
			}
			throw success;
		}
	}

	async conditionalFormat(
		targetCols: number[],
		rule: sheets_v4.Schema$ConditionalFormatRule,
	) {
		targetCols = targetCols.filter((c) => 0 <= c);
		if (targetCols.length === 0) {
			sendLog('Add conditional format rule, target is empty');
		}
		const ranges = targetCols.map((c) => ({
			sheetId: this.id,
			startColumnIndex: c,
			endColumnIndex: c + 1,
		}));
		sendLog('Add conditional format rule: %O, %O', targetCols, rule);
		await this.#parent.batchUpdate({
			addConditionalFormatRule: {
				rule: {
					ranges,
					...rule,
				},
			},
		});
	}

	async frozen(col: number, row: number) {
		sendLog('Frozen: ColumnCount: %d, RowCount: %d', col, row);
		const err = await this.#parent
			.batchUpdate({
				updateSheetProperties: {
					fields: 'gridProperties.frozenColumnCount,gridProperties.frozenRowCount',
					properties: {
						sheetId: this.id,
						gridProperties: {
							frozenColumnCount: col,
							frozenRowCount: row,
						},
					},
				},
			})
			.catch((error: GaxiosError) => error);

		if (err instanceof GaxiosError) {
			sendLog('Frozen failed: %s', err);
			return;
		}

		if (!err || err instanceof Error) {
			throw err;
		}

		sendLog('Frozen succeeded');
	}

	getColNumByHeaderName(name: string) {
		if (!this.#headers) {
			return -1;
		}
		const index = this.#headers.indexOf(name);
		sheetLog('Find header: "%s" -> %d', name, index);
		return index;
	}

	async hideCol(colNum: number) {
		sendLog('Hide col %d', colNum);
		await this.#parent.batchUpdate({
			updateDimensionProperties: {
				range: {
					sheetId: this.id,
					dimension: 'COLUMNS',
					startIndex: colNum,
					endIndex: colNum + 1,
				},
				properties: {
					hiddenByUser: true,
				},
				fields: 'hiddenByUser',
			},
		});
	}

	async setHeaders(headers: string[]) {
		this.#headers = headers;

		sheetLog('Create headers');
		const headerCells = headers.map(
			(h) => new Cell({ value: h, textFormat: { bold: true } }),
		);
		await this.addRowData([headerCells], false);
	}

	async #addRowData(data: Row[]) {
		if (data.length === 0) {
			return;
		}

		const startGrid = {
			columnIndex: 0,
			rowIndex: this.#currentRowIndex,
		};

		const sendData = data.map((row) => ({
			values: row.map((cell) => cell.provide()),
		}));

		const bData = JSON.stringify(sendData);
		const bDataBuffer = Buffer.from(bData);
		const rows = sendData.length;
		const cols = sendData[0]?.values?.length || 0;
		sendLog(
			'Update cells: %d rows, %d cols, %d bytes, to grid: %O',
			rows,
			cols,
			bDataBuffer.byteLength,
			startGrid,
		);
		await this.#expandGrid(rows, cols);
		const res = await this.#parent.batchUpdate({
			updateCells: {
				fields: '*',
				start: {
					sheetId: this.id,
					...startGrid,
				},
				rows: sendData,
			},
		});
		sendLog('updateCells succeeded');

		return res;
	}

	async #addRowQueue(data: Row[], numOfReq: number) {
		const total = data.length;
		if (data.length < numOfReq) {
			await this.#addRowData(data);
			return true;
		}
		const chunks = splitArray(data, numOfReq);
		let done = 0;
		for (const chunk of chunks) {
			const chunkLength = chunk.length;
			sheetLog(
				'Add %d items to sheet (%d%% %d/%d)',
				chunkLength,
				Math.round((done / total) * 100),
				done,
				total,
			);
			await this.#addRowData(chunk);
			done += chunkLength;
		}
		return true;
	}

	async #expandGrid(addRows: number, maxCols: number) {
		const rows = this.#currentRowIndex;
		const cols = this.#currentColIndex;
		const distRows = rows + addRows;
		const addCol = maxCols - cols;
		sendLog('Expand grid rows: +%d (%d -> %d)', addRows, rows, distRows);
		sendLog('Expand grid cols: +%d (%d -> %d)', addCol, cols, maxCols);
		if (addRows > 0) {
			await this.#parent.batchUpdate({
				appendDimension: {
					dimension: 'ROWS',
					sheetId: this.id,
					length: addRows,
				},
			});
			sendLog('Expand rows succeed');
			this.#currentRowIndex = distRows;
		} else {
			this.#currentRowIndex = 1;
		}
		if (0 < addCol) {
			await this.#parent.batchUpdate({
				appendDimension: {
					dimension: 'COLUMNS',
					sheetId: this.id,
					length: addCol,
				},
			});
			sendLog('Expand cols succeed');
			this.#currentColIndex = maxCols;
		}
	}
}
