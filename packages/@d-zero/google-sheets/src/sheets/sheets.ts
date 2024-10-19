import type { OAuth2Client } from 'google-auth-library';
import type { sheets_v4 } from 'googleapis';

import { google } from 'googleapis';

import { log } from '../debug.js';

import { ErrorHandler } from './error-handler.js';
import { getIdFromSheetUrl } from './get-id-from-sheet-url.js';
import { Sheet } from './sheet.js';

const sheetsLog = log.extend('Sheets');

export class Sheets {
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

	@ErrorHandler()
	async batchUpdate(request: sheets_v4.Schema$Request) {
		const requestNames = Object.keys(request) as (keyof sheets_v4.Schema$Request)[];
		const requestName = requestNames[0];
		if (!requestName) {
			return;
		}
		// @ts-ignore
		const sheetId = request[requestName]?.sheetId ?? request[requestName]?.start?.sheetId;
		sheetsLog(`Sheet(#${sheetId})::BatchUpdate.${requestName}`);
		const res = await this.#sheets.spreadsheets.batchUpdate({
			spreadsheetId: this.#spreadsheetId,
			requestBody: {
				requests: [request],
			},
		});

		return res;
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

	@ErrorHandler()
	async getRawSheetList() {
		const list = await this.#sheets.spreadsheets.get({
			spreadsheetId: this.#spreadsheetId,
		});

		return list.data.sheets ?? [];
	}
}
