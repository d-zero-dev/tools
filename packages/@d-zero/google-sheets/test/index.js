import assert from 'node:assert';
import path from 'node:path';

import { authentication } from '@d-zero/google-auth';
import { config as dotenvConfig } from 'dotenv';

import { SheetTable } from '../dist/index.js';

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

const table = await SheetTable.create(
	'https://docs.google.com/spreadsheets/d/17GnB9QSu0kXYxGh9axhWE7SUVfuHwvc_qHraCp8_2-U/edit#gid=0',
	'Sheet1',
	auth,
	{
		// headerRowNumber: 1,
		search: ['head1', 'head2', 'head3', 'head4'],
	},
);

const data = await table.getData();

assert.deepStrictEqual(data, [
	{ head1: '2025/10/27', head2: '1', head3: 'あいうえお', head4: 'TRUE' },
	{ head1: '2025/10/28', head2: '2', head3: 'あいうえお', head4: 'FALSE' },
	{ head1: '2025/10/29', head2: '3', head3: 'あいうえお', head4: 'TRUE' },
	{ head1: '2025/10/30', head2: '4', head3: 'あいうえお', head4: 'FALSE' },
	{ head1: '2025/10/31', head2: '5', head3: 'あいうえお', head4: 'TRUE' },
	{ head1: '2025/11/1', head2: '6', head3: 'あいうえお', head4: 'FALSE' },
	{ head1: '2025/11/2', head2: '7', head3: 'あいうえお', head4: 'TRUE' },
	{ head1: '2025/11/3', head2: '8', head3: 'あいうえお', head4: 'FALSE' },
	{ head1: '2025/11/4', head2: '9', head3: 'あいうえお', head4: 'TRUE' },
	{ head1: '2025/11/5', head2: '10', head3: 'あいうえお', head4: 'FALSE' },
	{ head1: '2025/11/6', head2: '11', head3: 'あいうえお', head4: 'TRUE' },
	{ head1: '2025/11/7', head2: '12', head3: 'あいうえお', head4: 'FALSE' },
	{ head1: '2025/11/8', head2: '13', head3: 'あいうえお', head4: 'TRUE' },
	{ head1: '2025/11/9', head2: '14', head3: 'あいうえお', head4: 'FALSE' },
	{ head1: '2025/11/10', head2: '15', head3: 'あいうえお', head4: 'TRUE' },
]);
