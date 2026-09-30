import { describe, test, expect } from 'vitest';

import { getIdFromSheetUrl } from './get-id-from-sheet-url.js';
import { parseGoogleUrl } from './parse-google-url.js';

describe('parseGoogleUrl', () => {
	test.each([
		['https://drive.google.com/drive/folders/abc123', 'abc123'],
		['https://drive.google.com/drive/folders/abc123?usp=sharing', 'abc123'],
		['https://drive.google.com/drive/u/1/folders/abc123', 'abc123'],
		['https://drive.google.com/drive/folders/abc123#section', 'abc123'],
	])('フォルダ URL を判別する: %s', (url, id) => {
		expect(parseGoogleUrl(url)).toStrictEqual({ kind: 'drive-folder', id });
	});

	test.each([
		['https://docs.google.com/spreadsheets/d/xyz789/edit', 'xyz789'],
		['https://docs.google.com/spreadsheets/d/xyz789/edit#gid=0', 'xyz789'],
		['https://docs.google.com/spreadsheets/u/0/d/xyz789/edit', 'xyz789'],
		['https://docs.google.com/a/example.com/spreadsheets/d/xyz789/edit', 'xyz789'],
	])('スプレッドシート URL を判別する: %s', (url, id) => {
		expect(parseGoogleUrl(url)).toStrictEqual({ kind: 'spreadsheet', id });
	});

	test.each([
		['マイドライブ直下', 'https://drive.google.com/drive/my-drive'],
		['Drive のファイル URL', 'https://drive.google.com/file/d/abc123/view'],
		['open?id=（種別を判別できない）', 'https://drive.google.com/open?id=abc123'],
		['Google ドキュメント', 'https://docs.google.com/document/d/abc123/edit'],
		['無関係なホスト', 'https://example.com/drive/folders/abc123'],
		['URL でない文字列', 'not a url'],
		['空文字', ''],
	])('受理対象外は null: %s', (_label, url) => {
		expect(parseGoogleUrl(url)).toBeNull();
	});
});

describe('getIdFromSheetUrl', () => {
	test('スプレッドシート URL から ID を返す', () => {
		expect(getIdFromSheetUrl('https://docs.google.com/spreadsheets/d/xyz789/edit')).toBe(
			'xyz789',
		);
	});

	test('フォルダ URL では null', () => {
		expect(getIdFromSheetUrl('https://drive.google.com/drive/folders/abc123')).toBeNull();
	});
});
