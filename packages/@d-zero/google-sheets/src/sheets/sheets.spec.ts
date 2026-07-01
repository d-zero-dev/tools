import type { ErrorHandlerMessage } from './error-handler.js';
import type { OAuth2Client } from 'google-auth-library';

import { GaxiosError } from 'gaxios';
import { describe, test, expect, vi, beforeEach } from 'vitest';

const { batchUpdateMock, spreadsheetsGetMock, valuesGetMock, errorLogMock } = vi.hoisted(
	() => ({
		batchUpdateMock: vi.fn(),
		spreadsheetsGetMock: vi.fn(),
		valuesGetMock: vi.fn(),
		errorLogMock: vi.fn(),
	}),
);

vi.mock('googleapis', () => ({
	google: {
		sheets: vi.fn(() => ({
			spreadsheets: {
				batchUpdate: batchUpdateMock,
				get: spreadsheetsGetMock,
				values: { get: valuesGetMock },
			},
		})),
	},
}));

vi.mock('@d-zero/shared/delay', () => ({
	delay: vi.fn().mockResolvedValue(),
}));

vi.mock('../debug.js', () => {
	type LogFn = ((...args: unknown[]) => void) & { extend: (name: string) => LogFn };
	const makeLog = (): LogFn =>
		Object.assign(() => {}, {
			extend(name: string): LogFn {
				if (name === 'Error') return errorLogMock as unknown as LogFn;
				return makeLog();
			},
		});
	return { log: makeLog() };
});

const { Sheets } = await import('./sheets.js');

/**
 * 502 (Bad Gateway) を返す GaxiosError を生成。
 */
function createGaxios502(): GaxiosError {
	return new GaxiosError('502', { url: 'test' }, {
		status: 502,
		statusText: 'Bad Gateway',
		headers: {},
		config: { url: 'test' },
		data: '',
		request: { responseURL: 'test' },
	} as never);
}

const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/abc123/edit';
const fakeAuth = {} as unknown as OAuth2Client;

/**
 * `Sheets` の各メソッドとそれに対応する googleapis モック・期待ラベルの対応表。
 * 全メソッドが同じ handlerFor パターンで配線されているため、テーブル駆動で網羅する。
 */
const methods = [
	{
		name: 'batchUpdate' as const,
		expectedLabel: 'Sheets.batchUpdate',
		mock: batchUpdateMock,
		successValue: { data: { replies: [] } },
		invoke: (sheets: InstanceType<typeof Sheets>) =>
			sheets.batchUpdate({ addSheet: { properties: { title: 't' } } }),
	},
	{
		name: 'get' as const,
		expectedLabel: 'Sheets.get',
		mock: valuesGetMock,
		successValue: { data: {} },
		invoke: (sheets: InstanceType<typeof Sheets>) => sheets.get({ range: 'A1' }),
	},
	{
		name: 'getRawSheetList' as const,
		expectedLabel: 'Sheets.getRawSheetList',
		mock: spreadsheetsGetMock,
		successValue: { data: { sheets: [] } },
		invoke: (sheets: InstanceType<typeof Sheets>) => sheets.getRawSheetList(),
	},
	{
		name: 'getWithGridData' as const,
		expectedLabel: 'Sheets.getWithGridData',
		mock: spreadsheetsGetMock,
		successValue: { data: { sheets: [] } },
		invoke: (sheets: InstanceType<typeof Sheets>) => sheets.getWithGridData('A1:B2'),
	},
];

beforeEach(() => {
	batchUpdateMock.mockReset();
	spreadsheetsGetMock.mockReset();
	valuesGetMock.mockReset();
	errorLogMock.mockReset();
});

describe('Sheets - onLog wiring (per method)', () => {
	for (const { name, expectedLabel, mock, successValue, invoke } of methods) {
		test(`${name}: 502 リトライ時に onLog が waiting: true/false で呼ばれる`, async () => {
			mock.mockRejectedValueOnce(createGaxios502()).mockResolvedValue(successValue);

			const sheets = new Sheets(spreadsheetUrl, fakeAuth);
			const messages: ErrorHandlerMessage[] = [];
			sheets.onLog = (msg) => messages.push(msg);

			await invoke(sheets);

			expect(messages).toHaveLength(2);
			expect(messages[0]).toMatchObject({ waiting: true, code: 502 });
			expect(messages[1]).toMatchObject({ waiting: false, code: 502 });
		});

		test(`${name}: onLog 未設定でもリトライは動作する`, async () => {
			mock.mockRejectedValueOnce(createGaxios502()).mockResolvedValue(successValue);

			const sheets = new Sheets(spreadsheetUrl, fakeAuth);

			await expect(invoke(sheets)).resolves.toBeDefined();
		});

		test(`${name}: Max retries 超過時のログに ${expectedLabel} が含まれる`, async () => {
			mock.mockRejectedValue(createGaxios502());

			const sheets = new Sheets(spreadsheetUrl, fakeAuth);

			await expect(invoke(sheets)).rejects.toThrow(GaxiosError);

			expect(errorLogMock).toHaveBeenCalledWith(
				expect.stringContaining(`Max retries (10) exceeded in ${expectedLabel}()`),
			);
		});
	}
});
