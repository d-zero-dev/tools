import type { OAuth2Client } from 'google-auth-library';

import { GaxiosError } from 'gaxios';
import { describe, test, expect, vi, beforeEach } from 'vitest';

const { filesCreateMock } = vi.hoisted(() => ({
	filesCreateMock: vi.fn(),
}));

vi.mock('googleapis', () => ({
	google: {
		drive: vi.fn(() => ({
			files: { create: filesCreateMock },
		})),
	},
}));

vi.mock('@d-zero/shared/delay', () => ({
	delay: vi.fn().mockResolvedValue(),
}));

vi.mock('./debug.js', () => {
	type LogFn = ((...args: unknown[]) => void) & { extend: (name: string) => LogFn };
	const makeLog = (): LogFn => Object.assign(() => {}, { extend: () => makeLog() });
	return { log: makeLog() };
});

const { createSpreadsheet } = await import('./create-spreadsheet.js');

const fakeAuth = {} as unknown as OAuth2Client;
const folderUrl = 'https://drive.google.com/drive/folders/folder123?usp=sharing';

beforeEach(() => {
	filesCreateMock.mockReset();
});

describe('createSpreadsheet', () => {
	test('フォルダ内にスプレッドシートを作成し、id と url を返す', async () => {
		filesCreateMock.mockResolvedValue({ data: { id: 'new123' } });

		const result = await createSpreadsheet(folderUrl, '集計結果', fakeAuth);

		expect(filesCreateMock).toHaveBeenCalledExactlyOnceWith({
			requestBody: {
				name: '集計結果',
				mimeType: 'application/vnd.google-apps.spreadsheet',
				parents: ['folder123'],
			},
			supportsAllDrives: true,
			fields: 'id',
		});
		expect(result).toStrictEqual({
			id: 'new123',
			url: 'https://docs.google.com/spreadsheets/d/new123/edit',
		});
	});

	test.each([
		['スプレッドシート URL', 'https://docs.google.com/spreadsheets/d/abc/edit'],
		['マイドライブ直下', 'https://drive.google.com/drive/my-drive'],
		['URL でない文字列', 'folder123'],
	])('フォルダ URL でなければ API を呼ばず URIError: %s', async (_label, url) => {
		await expect(createSpreadsheet(url, 'title', fakeAuth)).rejects.toThrow(URIError);
		expect(filesCreateMock).not.toHaveBeenCalled();
	});

	test('レスポンスに id が無ければエラー', async () => {
		filesCreateMock.mockResolvedValue({ data: {} });

		await expect(createSpreadsheet(folderUrl, 'title', fakeAuth)).rejects.toThrow(
			'Drive API response does not contain file id',
		);
	});

	test('リトライ対象の 502 でもリトライせずそのまま伝播する', async () => {
		const error = new GaxiosError('502', { url: 'test' }, {
			status: 502,
			statusText: 'Bad Gateway',
			headers: {},
			config: { url: 'test' },
			data: '',
			request: { responseURL: 'test' },
		} as never);
		filesCreateMock.mockRejectedValue(error);

		await expect(createSpreadsheet(folderUrl, 'title', fakeAuth)).rejects.toBe(error);
		expect(filesCreateMock).toHaveBeenCalledOnce();
	});
});
