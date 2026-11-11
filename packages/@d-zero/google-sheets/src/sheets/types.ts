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

export type CellType = 'string' | 'number' | 'boolean' | 'date' | 'formula' | 'error';

export type CellTypeInfo = {
	readonly index: number;
	readonly type: CellType;
};

/**
 * `Sheet.protect` の任意オプション。
 *
 * `editors` を省略（または空配列）すると `editors.users` は空配列になり、
 * シートを編集できるのはスプレッドシートの所有者だけになる。
 * 実行者が所有者でないときに自分も編集するなら、自分のメールを渡す。
 *
 * `warningOnly: true` のときは確認ダイアログだけで誰でも編集でき、
 * `editors` は API が無視するため送らない。
 *
 * `description` は UI の「シートと範囲を保護」右パネルの見出し。
 * 編集権限や警告ダイアログの本文は変わらない。`undefined` のときだけ
 * リクエストから省き、空文字は明示値として送る。
 * @example
 * ```ts
 * const options: SheetProtectOptions = {
 *   editors: ['owner@example.com'],
 *   description: '集計シート',
 * };
 * await sheet.protect(options);
 * ```
 */
export type SheetProtectOptions = {
	/** シートを編集できるユーザーのメール。省略または空配列なら所有者のみ */
	readonly editors?: readonly string[];
	/** `true` なら確認ダイアログのみ。このとき `editors` は送らない */
	readonly warningOnly?: boolean;
	/** 保護一覧の見出し。権限やダイアログ本文は変えない */
	readonly description?: string;
};
