import type { ErrorHandlerMessage } from './error-handler.js';
import type { OAuth2Client } from 'google-auth-library';
import type { sheets_v4 } from 'googleapis';

import { google } from 'googleapis';

import { log } from '../debug.js';

import { createErrorHandler } from './error-handler.js';
import { getIdFromSheetUrl } from './get-id-from-sheet-url.js';
import { Sheet } from './sheet.js';

const sheetsLog = log.extend('Sheets');

/**
 * `Sheets` インスタンスのメソッド用エラーハンドラを生成する。
 *
 * 診断ラベルは `Sheets.${method.name}` の組み立て。
 * - クラス名は当ファイル内のリテラル `'Sheets'` で固定する（下流 bundler の minify で
 *   クラス識別子が mangle されてもログ可読性を保つため）
 * - `method.name` は引数経由で動的に取得することで IDE rename に追従する。ただし terser の
 *   `mangle.properties` のような aggressive な property-mangling を有効にした環境では
 *   method 側も mangle されうる — その場合は下流側で reserved 指定するか function 名保持オプションを検討
 *
 * 並列呼び出しの retry カウンタ独立性は {@link createErrorHandler} 内部の per-call
 * 再帰引数によって担保されており、ハンドラの per-instance allocation はそれと独立。
 * eager allocation コストは 1 インスタンスあたり 4 closure 程度で軽微だが、`Sheets`
 * を hot-loop で大量生成するケースが出た場合は lazy 化を検討。
 * @param sheets - 対象の `Sheets` インスタンス
 * @param method - 対象メソッド（`name` プロパティのみを参照）
 * @param method.name
 */
function handlerFor(sheets: Sheets, method: { readonly name: string }) {
	return createErrorHandler(`Sheets.${method.name}`, {
		log: (message) => sheets.onLog?.(message),
	});
}

export class Sheets {
	onLog?: (message: ErrorHandlerMessage) => void;
	readonly #handleBatchUpdate = handlerFor(this, this.batchUpdate);
	readonly #handleGet = handlerFor(this, this.get);
	readonly #handleGetRawSheetList = handlerFor(this, this.getRawSheetList);
	readonly #handleGetWithGridData = handlerFor(this, this.getWithGridData);
	readonly #sheetList = new Map<string, Sheet>();
	readonly #sheets: sheets_v4.Sheets;
	readonly #spreadsheetId: string;

	get id() {
		return this.#spreadsheetId;
	}

	constructor(sheetUrl: string, auth: OAuth2Client) {
		const spreadsheetId = getIdFromSheetUrl(sheetUrl);
		sheetsLog(`Access ID: %s`, spreadsheetId);
		if (!spreadsheetId) {
			throw new URIError(`The URL is not spreadsheet URL: ${sheetUrl}`);
		}
		this.#spreadsheetId = spreadsheetId;

		this.#sheets = google.sheets({ version: 'v4', auth });
	}

	/**
	 * 1つの API リクエストを Google Sheets batchUpdate API に送信する。
	 *
	 * **設計上の注意: 複数リクエストのバッチ送信は意図的に行わない。**
	 *
	 * 理由:
	 * - Google Sheets batchUpdate API は非アトミック（部分成功あり）
	 * - エラーハンドラのリトライ（429/403/5xx/ECONNRESET）時に、成功済みの操作が重複実行される
	 * - appendDimension 等の非冪等操作では行・列の二重追加が発生する
	 * - addRowData の適応的チャンキング（RangeError 時にサイズ半減）が1リクエスト単位で機能
	 * @param request
	 */
	async batchUpdate(request: sheets_v4.Schema$Request) {
		return this.#handleBatchUpdate(async () => {
			const requestNames = Object.keys(request) as (keyof sheets_v4.Schema$Request)[];
			const requestName = requestNames[0];
			if (!requestName) {
				return;
			}
			const req = request[requestName] as
				| { sheetId?: string; start?: { sheetId?: string } }
				| undefined;
			const sheetId = req?.sheetId ?? req?.start?.sheetId;
			sheetsLog(`Sheet(#${sheetId})::BatchUpdate.${requestName}`);
			const res = await this.#sheets.spreadsheets.batchUpdate({
				spreadsheetId: this.#spreadsheetId,
				requestBody: {
					requests: [request],
				},
			});

			return res;
		});
	}

	async create(title: string): Promise<Sheet> {
		const targetSheet = this.#sheetList.get(title);
		if (targetSheet) {
			sheetsLog('Already %s sheet', title);
			return targetSheet;
		}

		const list = await this.getRawSheetList();

		const currentSheet = list?.find(({ properties }) => properties?.title === title);

		if (currentSheet) {
			const sheet = new Sheet(currentSheet, this);
			this.#sheetList.set(title, sheet);
			return sheet;
		}

		// Add new sheet
		const req = {
			addSheet: {
				properties: {
					title,
					gridProperties: {
						rowCount: 1,
						columnCount: 1,
					},
				},
			},
		} as const as sheets_v4.Schema$Request;

		sheetsLog('Create new sheet: %s', title);
		const res = await this.batchUpdate(req);

		if (!res?.data.replies || !res.data.replies[0]) {
			throw new Error('data.replies is empty');
		}

		const { addSheet } = res.data.replies[0];
		if (!addSheet) {
			throw new Error('addSheet response is empty');
		}

		const sheet = new Sheet(addSheet, this);
		this.#sheetList.set(title, sheet);
		return sheet;
	}

	async get(
		request: Omit<sheets_v4.Params$Resource$Spreadsheets$Values$Get, 'spreadsheetId'>,
	) {
		return this.#handleGet(async () => {
			const res = await this.#sheets.spreadsheets.values.get({
				...request,
				spreadsheetId: this.#spreadsheetId,
			});
			return res;
		});
	}

	async getRawSheetList() {
		return this.#handleGetRawSheetList(async () => {
			const list = await this.#sheets.spreadsheets.get({
				spreadsheetId: this.#spreadsheetId,
			});

			return list.data.sheets ?? [];
		});
	}

	async getWithGridData(range: string) {
		return this.#handleGetWithGridData(async () => {
			const res = await this.#sheets.spreadsheets.get({
				spreadsheetId: this.#spreadsheetId,
				ranges: [range],
				includeGridData: true,
			});
			return res;
		});
	}
}
