import type { CellData, CellRawData } from './types.js';
import type { sheets_v4 } from 'googleapis';

import { decodeURISafely } from '@d-zero/shared/decode-uri-safely';

export class Cell<T extends CellRawData = CellRawData> {
	readonly #data: CellData<T>;

	constructor(data: CellData<T>) {
		this.#data = data;
	}

	provide(noteMaxLength = 5000): sheets_v4.Schema$CellData {
		const { textFormat, note, ifNull, image } = this.#data;
		let cellFormat = this.#data.cellFormat;
		let value = this.#data.value;
		let cellValue: sheets_v4.Schema$ExtendedValue;
		let hyperlink: string | null = null;
		if (ifNull != null && value == null) {
			value = ifNull;
		}
		if (typeof value === 'string') {
			const strValue = value.trim();
			if (image) {
				cellValue = {
					formulaValue: `=IMAGE("${decodeURISafely(strValue)}", 1)`,
				};
			} else if (strValue.trim()[0] === '=') {
				cellValue = { formulaValue: strValue };
			} else {
				cellValue = {
					stringValue: limit(strValue),
				};
				if (textFormat?.link?.uri) {
					hyperlink = textFormat.link.uri.trim();
					cellValue = {
						formulaValue: `=HYPERLINK("${strValue.replaceAll('"', '\\"')}", "${decodeURISafely(hyperlink)}")`,
					};
				}
			}
		} else if (typeof value === 'number') {
			cellValue = { numberValue: value };
		} else if (typeof value === 'boolean') {
			cellValue = { boolValue: value };
		} else if (value instanceof Date) {
			const timestamp = value.getTime();
			const timezoneOffset = value.getTimezoneOffset() * 60 * 1000;
			cellValue = {
				numberValue: (timestamp + timezoneOffset * -1) / 86_400_000 + 25_569,
			};
			cellFormat = {
				numberFormat: {
					type: 'DATE_TIME',
					pattern: 'yyyy-mm-dd hh:mm',
				},
				...cellFormat,
			};
		} else {
			cellValue = {
				stringValue: '',
			};
		}

		let _note = note;
		if (typeof note === 'string' && noteMaxLength < note.length) {
			_note = note.slice(0, noteMaxLength) + '\n\n...\nToo Large Text';
		}

		return {
			userEnteredValue: cellValue,
			userEnteredFormat: {
				...cellFormat,
				textFormat: textFormat || undefined,
				hyperlinkDisplayType: hyperlink ? 'LINKED' : undefined,
				horizontalAlignment: 'LEFT',
				verticalAlignment: 'TOP',
				wrapStrategy: cellFormat?.wrapStrategy ?? 'WRAP',
			},
			hyperlink,
			note: _note,
		};
	}
}

function limit(str: string) {
	return str.slice(0, 50_000 - 1);
}
