import assert from 'node:assert';
import path from 'node:path';

import { config as dotenvConfig } from 'dotenv';
import { google } from 'googleapis';

import { authentication } from '../dist/index.js';

const envPath = path.join(import.meta.dirname, '..', '..', '..', '..', '.env');

dotenvConfig({
	path: envPath,
});

const googleAuthCredentials = process.env.GOOGLE_AUTH_CREDENTIALS;
if (!googleAuthCredentials) {
	throw new Error('GOOGLE_AUTH_CREDENTIALS is not set');
}

const auth = await authentication(googleAuthCredentials, [
	'https://www.googleapis.com/auth/spreadsheets',
]);

const sheets = google.sheets({ version: 'v4', auth });

const res = await sheets.spreadsheets.values.get({
	spreadsheetId: '17GnB9QSu0kXYxGh9axhWE7SUVfuHwvc_qHraCp8_2-U',
	range: 'Sheet1!A2:D',
});

assert.deepStrictEqual(res.data.values, [
	['2025/10/27', '1', 'あいうえお', 'TRUE'],
	['2025/10/28', '2', 'あいうえお', 'FALSE'],
	['2025/10/29', '3', 'あいうえお', 'TRUE'],
	['2025/10/30', '4', 'あいうえお', 'FALSE'],
	['2025/10/31', '5', 'あいうえお', 'TRUE'],
	['2025/11/1', '6', 'あいうえお', 'FALSE'],
	['2025/11/2', '7', 'あいうえお', 'TRUE'],
	['2025/11/3', '8', 'あいうえお', 'FALSE'],
	['2025/11/4', '9', 'あいうえお', 'TRUE'],
	['2025/11/5', '10', 'あいうえお', 'FALSE'],
	['2025/11/6', '11', 'あいうえお', 'TRUE'],
	['2025/11/7', '12', 'あいうえお', 'FALSE'],
	['2025/11/8', '13', 'あいうえお', 'TRUE'],
	['2025/11/9', '14', 'あいうえお', 'FALSE'],
	['2025/11/10', '15', 'あいうえお', 'TRUE'],
]);
