import type { CellData } from './sheets/types.js';
import type { sheets_v4 } from 'googleapis';

import { Cell } from './sheets/cell.js';

/**
 * @param data
 * @param defaultCellFormat 全セルに適用するデフォルトの cellFormat。
 *   個別セルの cellFormat で同じプロパティが指定された場合はそちらが優先される。
 */
export function createCellData(
	data: CellData | (() => CellData),
	defaultCellFormat?: sheets_v4.Schema$CellFormat,
): Cell {
	if (typeof data === 'function') {
		return new LazyCell(data, defaultCellFormat);
	}
	return new Cell(applyReadable(data, defaultCellFormat));
}

/**
 *
 * @param text
 */
function readable(text: string | null | undefined) {
	if (!text) {
		return '';
	}
	return text.trim().replaceAll(/(?:\r?\n)+|\s+/g, ' ');
}

/**
 *
 * @param data
 * @param defaultCellFormat
 */
function applyReadable(
	data: CellData,
	defaultCellFormat?: sheets_v4.Schema$CellFormat,
): CellData {
	return {
		...data,
		value: typeof data.value === 'string' ? readable(data.value) : data.value,
		cellFormat: defaultCellFormat
			? { ...defaultCellFormat, ...data.cellFormat }
			: data.cellFormat,
	};
}

class LazyCell extends Cell {
	readonly #defaultCellFormat?: sheets_v4.Schema$CellFormat;
	readonly #thunk: () => CellData;

	constructor(thunk: () => CellData, defaultCellFormat?: sheets_v4.Schema$CellFormat) {
		super({ value: '' });
		this.#thunk = thunk;
		this.#defaultCellFormat = defaultCellFormat;
	}
	override provide(noteMaxLength?: number) {
		const cell = new Cell(applyReadable(this.#thunk(), this.#defaultCellFormat));
		return cell.provide(noteMaxLength);
	}
}
