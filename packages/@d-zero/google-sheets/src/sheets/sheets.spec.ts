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

describe('Sheets - url', () => {
	test('ID から編集 URL を組み立てる', () => {
		const sheets = new Sheets(
			'https://docs.google.com/spreadsheets/d/abc123/edit#gid=0',
			fakeAuth,
		);

		expect(sheets.url).toBe('https://docs.google.com/spreadsheets/d/abc123/edit');
	});

	test('スプレッドシート URL でなければ URIError', () => {
		expect(
			() => new Sheets('https://drive.google.com/drive/folders/abc123', fakeAuth),
		).toThrow(URIError);
	});
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

/**
 * 別の版の gaxios が生成した 429 を模したエラーを作る。
 *
 * `new GaxiosError()` ではこのパッケージの `GaxiosError` と同じクラスになり再現にならないため、
 * 別の版が付けるシンボルと `response.status` だけを持つ素の `Error` にする。
 */
function createForeign429(): Error {
	const error: Error & { response?: unknown } = new Error('Quota exceeded');
	Object.defineProperty(error, Symbol.for('gaxios-gaxios-error'), {
		value: '0.0.0-other',
	});
	error.response = { status: 429, statusText: 'Too Many Requests' };
	return error;
}

describe('Sheets - 別の版の gaxios が生成したエラー (per method)', () => {
	for (const { name, mock, successValue, invoke } of methods) {
		test(`${name}: 429 でもリトライされ、onLog が waiting: true/false で呼ばれる`, async () => {
			mock.mockRejectedValueOnce(createForeign429()).mockResolvedValue(successValue);

			const sheets = new Sheets(spreadsheetUrl, fakeAuth);
			const messages: ErrorHandlerMessage[] = [];
			sheets.onLog = (msg) => messages.push(msg);

			await expect(invoke(sheets)).resolves.toBeDefined();

			expect(mock).toHaveBeenCalledTimes(2);
			expect(messages).toHaveLength(2);
			expect(messages[0]).toMatchObject({ waiting: true, code: 429 });
			expect(messages[1]).toMatchObject({ waiting: false, code: 429 });
		});
	}
});

describe('Sheets - sheet title cache', () => {
	test('rename 後の create は新しいタイトルで同じインスタンスを返す', async () => {
		spreadsheetsGetMock.mockResolvedValue({
			data: {
				sheets: [{ properties: { title: 'Old', sheetId: 1, index: 0 } }],
			},
		});
		batchUpdateMock.mockResolvedValue({});

		const sheets = new Sheets(spreadsheetUrl, fakeAuth);
		const sheet = await sheets.create('Old');
		await sheet.rename('New');

		const again = await sheets.create('New');
		expect(again).toBe(sheet);
		expect(again.props.title).toBe('New');
	});

	test('rename 後に旧タイトルで create すると別インスタンスを作る', async () => {
		spreadsheetsGetMock
			.mockResolvedValueOnce({
				data: {
					sheets: [{ properties: { title: 'Old', sheetId: 1, index: 0 } }],
				},
			})
			.mockResolvedValueOnce({
				data: { sheets: [] },
			});
		batchUpdateMock.mockResolvedValueOnce({}).mockResolvedValueOnce({
			data: {
				replies: [
					{
						addSheet: {
							properties: { title: 'Old', sheetId: 2, index: 0 },
						},
					},
				],
			},
		});

		const sheets = new Sheets(spreadsheetUrl, fakeAuth);
		const sheet = await sheets.create('Old');
		await sheet.rename('New');

		const recreated = await sheets.create('Old');
		expect(recreated).not.toBe(sheet);
		expect(recreated.id).toBe(2);
	});

	test('move 後にキャッシュ済みシートの index が揃う', async () => {
		const initial = {
			data: {
				sheets: [
					{ properties: { title: 'A', sheetId: 1, index: 0 } },
					{ properties: { title: 'B', sheetId: 2, index: 1 } },
				],
			},
		};
		spreadsheetsGetMock
			.mockResolvedValueOnce(initial)
			.mockResolvedValueOnce(initial)
			.mockResolvedValueOnce({
				data: {
					sheets: [
						{ properties: { title: 'A', sheetId: 1, index: 1 } },
						{ properties: { title: 'B', sheetId: 2, index: 0 } },
					],
				},
			});
		batchUpdateMock.mockResolvedValue({});

		const sheets = new Sheets(spreadsheetUrl, fakeAuth);
		const a = await sheets.create('A');
		const b = await sheets.create('B');
		await a.move(1);

		expect(a.props.index).toBe(1);
		expect(b.props.index).toBe(0);
	});

	test('delete 後の create はリモートに無ければ新しいシートを作る', async () => {
		spreadsheetsGetMock
			.mockResolvedValueOnce({
				data: {
					sheets: [{ properties: { title: 'Temp', sheetId: 2, index: 0 } }],
				},
			})
			.mockResolvedValueOnce({
				data: { sheets: [] },
			});
		batchUpdateMock.mockResolvedValueOnce({}).mockResolvedValueOnce({
			data: {
				replies: [
					{
						addSheet: {
							properties: { title: 'Temp', sheetId: 99, index: 0 },
						},
					},
				],
			},
		});

		const sheets = new Sheets(spreadsheetUrl, fakeAuth);
		const first = await sheets.create('Temp');
		await first.delete();

		const second = await sheets.create('Temp');
		expect(second).not.toBe(first);
		expect(second.id).toBe(99);
		expect(batchUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				spreadsheetId: 'abc123',
				requestBody: {
					requests: [
						{
							addSheet: {
								properties: {
									title: 'Temp',
									gridProperties: { rowCount: 1, columnCount: 1 },
								},
							},
						},
					],
				},
			}),
		);
	});

	test('refreshCachedSheetIndices はキャッシュ済みシートの index を揃える', async () => {
		const initial = {
			data: {
				sheets: [
					{ properties: { title: 'A', sheetId: 1, index: 0 } },
					{ properties: { title: 'B', sheetId: 2, index: 1 } },
				],
			},
		};
		spreadsheetsGetMock
			.mockResolvedValueOnce(initial)
			.mockResolvedValueOnce(initial)
			.mockResolvedValueOnce({
				data: {
					sheets: [
						{ properties: { title: 'A', sheetId: 1, index: 1 } },
						{ properties: { title: 'B', sheetId: 2, index: 0 } },
					],
				},
			});

		const sheets = new Sheets(spreadsheetUrl, fakeAuth);
		const a = await sheets.create('A');
		const b = await sheets.create('B');
		expect(a.props.index).toBe(0);
		expect(b.props.index).toBe(1);

		await sheets.refreshCachedSheetIndices();

		expect(a.props.index).toBe(1);
		expect(b.props.index).toBe(0);
	});
});
