import type { ErrorHandlerMessage } from './error-handler.js';
import type { OAuth2Client } from 'google-auth-library';

import { GaxiosError } from 'gaxios';
import { describe, test, expect, vi, beforeEach } from 'vitest';

const { batchUpdateMock, errorLogMock } = vi.hoisted(() => ({
	batchUpdateMock: vi.fn(),
	errorLogMock: vi.fn(),
}));

vi.mock('googleapis', () => ({
	google: {
		sheets: vi.fn(() => ({
			spreadsheets: {
				batchUpdate: batchUpdateMock,
				get: vi.fn(),
				values: { get: vi.fn() },
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

beforeEach(() => {
	batchUpdateMock.mockReset();
	errorLogMock.mockReset();
});

describe('Sheets - onLog wiring', () => {
	test('502 リトライ時に onLog が waiting: true/false で呼ばれる', async () => {
		batchUpdateMock
			.mockRejectedValueOnce(createGaxios502())
			.mockResolvedValue({ data: { replies: [] } });

		const sheets = new Sheets(spreadsheetUrl, fakeAuth);
		const messages: ErrorHandlerMessage[] = [];
		sheets.onLog = (msg) => messages.push(msg);

		await sheets.batchUpdate({
			addSheet: { properties: { title: 't' } },
		});

		expect(messages).toHaveLength(2);
		expect(messages[0]).toMatchObject({ waiting: true, code: 502 });
		expect(messages[1]).toMatchObject({ waiting: false, code: 502 });
	});

	test('onLog 未設定でもリトライは動作する', async () => {
		batchUpdateMock
			.mockRejectedValueOnce(createGaxios502())
			.mockResolvedValue({ data: { replies: [] } });

		const sheets = new Sheets(spreadsheetUrl, fakeAuth);

		await expect(
			sheets.batchUpdate({ addSheet: { properties: { title: 't' } } }),
		).resolves.toBeDefined();
	});

	test('Max retries 超過時のログに Sheets.batchUpdate が含まれる', async () => {
		batchUpdateMock.mockRejectedValue(createGaxios502());

		const sheets = new Sheets(spreadsheetUrl, fakeAuth);

		await expect(
			sheets.batchUpdate({ addSheet: { properties: { title: 't' } } }),
		).rejects.toThrow(GaxiosError);

		expect(errorLogMock).toHaveBeenCalledWith(
			expect.stringContaining('Max retries (10) exceeded in Sheets.batchUpdate()'),
		);
	});
});
