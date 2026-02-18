import type { CellData } from './sheets/types.js';

import { Cell } from './sheets/cell.js';

/**
 *
 * @param data
 */
export function createCellData(data: CellData | (() => CellData)): Cell {
	if (typeof data === 'function') {
		return new LazyCell(data);
	}
	return new Cell(applyReadable(data));
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
 */
function applyReadable(data: CellData): CellData {
	return {
		...data,
		value: typeof data.value === 'string' ? readable(data.value) : data.value,
	};
}

class LazyCell extends Cell {
	readonly #thunk: () => CellData;
	constructor(thunk: () => CellData) {
		super({ value: '' });
		this.#thunk = thunk;
	}
	override provide(noteMaxLength?: number) {
		const cell = new Cell(applyReadable(this.#thunk()));
		return cell.provide(noteMaxLength);
	}
}
