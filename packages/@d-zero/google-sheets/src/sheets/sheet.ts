import type { Sheets } from './sheets.js';
import type { Row, CellTypeInfo } from './types.js';
import type { sheets_v4 } from 'googleapis';

import { splitArray } from '@d-zero/shared/split-array';
import { GaxiosError } from 'gaxios';

import { log } from '../debug.js';

import { Cell } from './cell.js';

const NUMBER_OF_PAGE_INFO_PER_ONE_REQUEST = 100_000;

/**
 * `appendRow()` / `flush()` がバッファをドレインする最大行数。
 *
 * Google Sheets API は 1 リクエストの本文を gzip 圧縮して送る。チャンクが
 * 大きすぎると圧縮中の中間文字列でヒープを圧迫し、呼び出し元が OOM に
 * 陥るケースがある（30k 行クラスのレポートで観測）。`addRowData()` が
 * 持つ `NUMBER_OF_PAGE_INFO_PER_ONE_REQUEST`（10 万）はあくまで API の
 * 単一リクエスト上限であり、メモリ安全性の指標ではない。`appendRow()`
 * は控えめな 2500 行で逐次 flush することで、呼び出し元の `Cell[][]`
 * 滞留量を抑える。
 */
const SEND_CHUNK_SIZE = 2500;

const sheetLog = log.extend('Sheet');
const sendLog = sheetLog.extend('Send');

export class Sheet {
	/**
	 * 内部 chunk flush ごとに呼ばれる進捗コールバック。`appendRow()` /
	 * `flush()` の内側で逐次 `#flushChunk()` が走り、各 chunk の
	 * `batchUpdate` 完了直後に呼び出される。
	 *
	 * 呼び出し元は累積送信行数 (`sent`) と未送信バッファ残量
	 * (`pending`) を受け取る。表示用途を想定しているため、コール
	 * バック自体が長時間ブロックすると次の chunk 送信が遅れる点に
	 *注意。{@link Sheets.onLog} と同じく Sheet インスタンスへ直接
	 * 代入する。
	 *
	 * 大量行を一括 `appendRow(...rows)` で渡すケース（典型例:
	 * Resources シートの dedupe 集約 63K 行）で「sending 中の進捗が
	 * 見えない」問題を解消するために用意した。普段は未設定で
	 * かまわない。
	 */
	onProgress?: (sent: number, pending: number) => void;
	#currentColIndex = 1;
	#currentRowIndex = 0;
	/**
	 * バッファ内に遅延セル（{@link Cell.prototype.provide} を上書きしたセル、
	 * 典型的には `createCellData(() => ...)` の thunk）を含む行が一度でも
	 * 入ったかを記録する。`true` の間は自動 flush を停止し、`flush()` が
	 * 明示的に呼ばれるまで送信を保留する。
	 *
	 * これは遅延セルが共有可変状態を参照することへの保険。呼び出し元が
	 * すべての state mutation を済ませた `flush()` 時点で初めて thunk を
	 * 評価することで、中間状態でのセル値破壊を防ぐ。FIFO 順を保つため、
	 * 一度 lazy が入ると後続の eager 行も同じバッファに留めおかれる。
	 */
	#hasLazyRow = false;
	#headers: readonly string[] | null = null;
	readonly #parent: Sheets;

	/**
	 * `appendRow()` で受け取った未送信行のバッファ。{@link SEND_CHUNK_SIZE}
	 * に達するか、`flush()` が呼ばれるとドレインされる。
	 */
	#pendingRows: Row[] = [];
	/**
	 * これまでに送信した累計行数。`appendRow()` / `flush()` の進捗を
	 * 呼び出し元（典型的には Lanes 表示）へ公開する用途。
	 */
	#sentCount = 0;
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

	/**
	 * `appendRow()` / `flush()` を通じてこれまでに送信した累計行数。
	 * 進捗表示用途。`setHeaders()` の送信分は含まない。
	 */
	get sentCount() {
		return this.#sentCount;
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

	/**
	 * 行を 1 件以上バッファへ追加し、必要に応じて自動 flush するストリーミング送信 API。
	 *
	 * ## 自動 flush 条件
	 *
	 * バッファ内の行が {@link SEND_CHUNK_SIZE} に達した時点で、先頭から
	 * 1 チャンク分（最大 {@link SEND_CHUNK_SIZE} 行）を `addRowData()` へ
	 * 流し込む。受け取った行に遅延セル（{@link Cell.prototype.provide}
	 * を上書きしたセル）が含まれる場合は自動 flush を停止し、明示的な
	 * {@link Sheet.flush} 呼び出しまで全行をバッファに保持する。
	 *
	 * FIFO 順を保つため、一度でも遅延行を受けたあとは後続の eager 行も
	 * 同じく保留される（順序の入れ替えを起こさない）。
	 *
	 * ## 利用パターン
	 *
	 * ```ts
	 * for (const page of pages) {
	 *   const rows = generateRows(page);
	 *   await sheet.appendRow(...rows);
	 * }
	 * await sheet.flush();
	 * ```
	 *
	 * 大量の行を生成 → 即送信したい場面では、呼び出し元で `for` ループを
	 * 書かずに済むよう可変長引数で受け取る。配列はスプレッド構文で渡せる。
	 *
	 * ## 同時実行の制約
	 *
	 * 同一 `Sheet` インスタンスへの `appendRow()` / `flush()` 呼び出しは
	 * **逐次**（前の `await` を待ってから次を呼ぶ）を前提に設計されている。
	 * 同じインスタンスに対して `Promise.all` 等で並行に呼ぶと、内部バッファの
	 * `splice` / `push` がインターリーブし、行順や送信件数が壊れる可能性が
	 * ある。並列処理が必要なら **シートインスタンスを分離** すること
	 * （例: `sheets.create('A')` と `sheets.create('B')` を別々に並列処理）。
	 * @param rows 追加する行（0 件以上、可変長）。
	 */
	async appendRow(...rows: Row[]) {
		for (const row of rows) {
			if (containsLazyCell(row)) {
				this.#hasLazyRow = true;
			}
			this.#pendingRows.push(row);
		}
		while (!this.#hasLazyRow && this.#pendingRows.length >= SEND_CHUNK_SIZE) {
			await this.#flushChunk();
		}
	}

	async conditionalFormat(
		targetCols: number[],
		rule: sheets_v4.Schema$ConditionalFormatRule,
	) {
		targetCols = targetCols.filter((c) => 0 <= c);
		if (targetCols.length === 0) {
			sendLog('Add conditional format rule, target is empty');
			return;
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
	/**
	 * 未送信のバッファ行を全て送り切る。
	 *
	 * 遅延セルを含むバッチを送る場合、呼び出し元が「すべての共有状態
	 * mutation を済ませた」タイミングでこの API を叩く想定。`flush()`
	 * 完了後はバッファが空になり、`#hasLazyRow` フラグもリセットされる
	 * ため、同じシートを次のラウンドで再びストリーミング送信できる。
	 *
	 * バッファが空のときは何もしない（no-op）。連続呼び出しも安全（冪等）。
	 *
	 * 並行呼び出しの制約は {@link Sheet.appendRow} の JSDoc を参照。
	 */
	async flush() {
		while (this.#pendingRows.length > 0) {
			await this.#flushChunk();
		}
		this.#hasLazyRow = false;
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
	async getCellTypes(range: string) {
		const res = await this.#parent.getWithGridData(`'${this.props.title}'!${range}`);
		const sheet = res.data.sheets?.[0];
		const rowData = sheet?.data?.[0]?.rowData?.[0];
		const cells = rowData?.values ?? [];

		const cellTypes: CellTypeInfo[] = cells.map((cell, index) => {
			const effectiveValue = cell.effectiveValue;
			const effectiveFormat = cell.effectiveFormat;

			if (!effectiveValue) {
				return { index, type: 'string' };
			}

			if (effectiveValue.numberValue !== undefined) {
				const numberFormatType = effectiveFormat?.numberFormat?.type;
				if (numberFormatType === 'DATE' || numberFormatType === 'DATE_TIME') {
					return { index, type: 'date' };
				}
				return { index, type: 'number' };
			} else if (effectiveValue.boolValue !== undefined) {
				return { index, type: 'boolean' };
			} else if (effectiveValue.formulaValue !== undefined) {
				return { index, type: 'formula' };
			} else if (effectiveValue.errorValue !== undefined) {
				return { index, type: 'error' };
			}

			return { index, type: 'string' };
		});

		return cellTypes;
	}
	getColNumByHeaderName(name: string) {
		if (!this.#headers) {
			return -1;
		}
		const index = this.#headers.indexOf(name);
		sheetLog('Find header: "%s" -> %d', name, index);
		return index;
	}
	/**
	 * Retrieves row visibility metadata starting from the specified row.
	 *
	 * - `hiddenByUser`: The row is manually hidden by a user (right-click → "Hide row")
	 * - `hiddenByFilter`: The row is hidden by a filter view or filter condition
	 * @see https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/sheets#DimensionProperties
	 * @param startRow - The 1-based row number to start fetching metadata from
	 * @returns Array of row visibility objects, one per row from `startRow` onward
	 */
	async getRowMetadata(startRow: number) {
		const res = await this.#parent.getWithGridData(
			`'${this.props.title}'!A${startRow}:A`,
		);
		const sheet = res.data.sheets?.[0];
		const rowMetadataList = sheet?.data?.[0]?.rowMetadata ?? [];
		return rowMetadataList.map((metadata) => ({
			hiddenByUser: metadata.hiddenByUser === true,
			hiddenByFilter: metadata.hiddenByFilter === true,
		}));
	}
	async getValues(row: string, col: string) {
		const res = await this.#parent.get({
			range: `'${this.props.title}'!${row}:${col}`,
			valueRenderOption: 'UNFORMATTED_VALUE',
		});
		return res.data.values;
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
	async overwriteHeaderFormat() {
		sendLog('Headers becomes normal format if NOT_BLANK');
		await this.#parent.batchUpdate({
			addConditionalFormatRule: {
				rule: {
					ranges: [
						{
							sheetId: this.id,
							startRowIndex: 0,
							endRowIndex: 1,
						},
					],
					booleanRule: {
						condition: {
							type: 'NOT_BLANK',
						},
						format: {
							backgroundColor: {
								red: 1,
								green: 1,
								blue: 1,
								alpha: 0,
							},
							textFormat: {
								foregroundColor: {
									red: 0,
									green: 0,
									blue: 0,
								},
							},
						},
					},
				},
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

		const rows = sendData.length;
		const cols = sendData[0]?.values?.length || 0;
		if (sendLog.enabled) {
			const byteLength = Buffer.byteLength(JSON.stringify(sendData));
			sendLog(
				'Update cells: %d rows, %d cols, %d bytes, to grid: %O',
				rows,
				cols,
				byteLength,
				startGrid,
			);
		}
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
	/**
	 * バッファ先頭から最大 {@link SEND_CHUNK_SIZE} 行を取り出し送信する。
	 * 内部用ヘルパー。
	 */
	async #flushChunk() {
		const chunk = this.#pendingRows.splice(0, SEND_CHUNK_SIZE);
		if (chunk.length === 0) {
			return;
		}
		await this.addRowData(chunk, true);
		this.#sentCount += chunk.length;
		this.onProgress?.(this.#sentCount, this.#pendingRows.length);
	}
}

/**
 * 行に遅延セル（`Cell.prototype.provide` を上書きしたセル、典型的には
 * `createCellData(() => ...)` で生成された thunk セル）が 1 つでも
 * 含まれていれば `true`。
 *
 * 遅延セルは `provide()` 評価時の共有状態を参照するため、ストリーミングで
 * 早期送信すると thunk がまだ確定していない時点で実行されてしまい、
 * 出力が破損する。`appendRow()` はこの検出結果を元に自動 flush を
 * 抑制する。
 * @param row 検査対象の行。
 */
function containsLazyCell(row: Row): boolean {
	for (const cell of row) {
		if (cell.provide !== Cell.prototype.provide) {
			return true;
		}
	}
	return false;
}
