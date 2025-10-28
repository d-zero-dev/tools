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
	{
		head1: new Date('2025-10-26T15:00:00.000Z'),
		head2: 1,
		head3: 'あいうえお',
		head4: true,
	},
	{
		head1: new Date('2025-10-27T15:00:00.000Z'),
		head2: 2,
		head3: 'あいうえお',
		head4: false,
	},
	{
		head1: new Date('2025-10-28T15:00:00.000Z'),
		head2: 3,
		head3: 'あいうえお',
		head4: true,
	},
	{
		head1: new Date('2025-10-29T15:00:00.000Z'),
		head2: 4,
		head3: 'あいうえお',
		head4: false,
	},
	{
		head1: new Date('2025-10-30T15:00:00.000Z'),
		head2: 5,
		head3: 'あいうえお',
		head4: true,
	},
	{
		head1: new Date('2025-10-31T15:00:00.000Z'),
		head2: 6,
		head3: 'あいうえお',
		head4: false,
	},
	{
		head1: new Date('2025-11-01T15:00:00.000Z'),
		head2: 7,
		head3: 'あいうえお',
		head4: true,
	},
	{
		head1: new Date('2025-11-02T15:00:00.000Z'),
		head2: 8,
		head3: 'あいうえお',
		head4: false,
	},
	{
		head1: new Date('2025-11-03T15:00:00.000Z'),
		head2: 9,
		head3: 'あいうえお',
		head4: true,
	},
	{
		head1: new Date('2025-11-04T15:00:00.000Z'),
		head2: 10,
		head3: 'あいうえお',
		head4: false,
	},
	{
		head1: new Date('2025-11-05T15:00:00.000Z'),
		head2: 11,
		head3: 'あいうえお',
		head4: true,
	},
	{
		head1: new Date('2025-11-06T15:00:00.000Z'),
		head2: 12,
		head3: 'あいうえお',
		head4: false,
	},
	{
		head1: new Date('2025-11-07T15:00:00.000Z'),
		head2: 13,
		head3: 'あいうえお',
		head4: true,
	},
	{
		head1: new Date('2025-11-08T15:00:00.000Z'),
		head2: 14,
		head3: 'あいうえお',
		head4: false,
	},
	{
		head1: new Date('2025-11-09T15:00:00.000Z'),
		head2: 15,
		head3: 'あいうえお',
		head4: true,
	},
]);
