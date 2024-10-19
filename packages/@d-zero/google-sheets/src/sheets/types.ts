import type { Cell } from './cell.js';
import type { sheets_v4 } from 'googleapis';

export type Row = readonly Cell[];

export type CellData<T extends CellRawData = CellRawData> = {
	readonly value: T;
	readonly textFormat?: sheets_v4.Schema$TextFormat | null;
	readonly cellFormat?: sheets_v4.Schema$CellFormat | null;
	readonly image?: boolean;
	readonly note?: string;
	readonly ifNull?: T;
};

export type CellRawData = string | number | boolean | Date | null | undefined;
