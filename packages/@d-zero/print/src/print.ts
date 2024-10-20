import type { PrintType } from './types.js';
import type { PageHook } from '@d-zero/puppeteer-page-scan';

import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { deal } from '@d-zero/puppeteer-dealer';
import c from 'ansi-colors';

import { pngToPdf } from './png-to-pdf.js';
import { printPdf } from './print-pdf.js';
import { printPng } from './print-png.js';

export interface PrintOptions {
	readonly type?: PrintType;
	readonly limit?: number;
	readonly debug?: boolean;
	readonly hooks?: readonly PageHook[];
}

export async function print(
	urlList: readonly (
		| string
		| {
				id: string | null;
				url: string;
		  }
	)[],
	options?: PrintOptions,
) {
	const dir = path.resolve(process.cwd(), '.print');
	await mkdir(dir, { recursive: true }).catch(() => {});

	const type = options?.type ?? 'png';
	const hooks = options?.hooks;

	await deal(
		urlList.map((url) => {
			if (typeof url === 'string') {
				return { id: null, url };
			}
			return url;
		}),
		(_, done, total) => {
			return `${c.bold.magenta('🎨 Print pages')} ${c.bgBlueBright(` ${type} `)} ${done}/${total}`;
		},
		{
			async deal(page, id, url, logger) {
				const ext = type === 'pdf' ? 'pdf' : 'png';
				const fileName = `${id}.${ext}`;
				const filePath = path.resolve(dir, fileName);

				if (type === 'pdf') {
					await printPdf(page, url, filePath, logger, hooks);
					logger('🔚 Closing');
					return;
				}

				const result = await printPng(page, url, id, filePath, logger, hooks);

				if (type === 'png') {
					logger('🔚 Closing');
					return;
				}

				await pngToPdf(page, result, logger);
				logger('🔚 Closing');
			},
		},
		options,
	);
}
