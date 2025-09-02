import type { PrintType } from './types.js';
import type { PageHook, Sizes } from '@d-zero/puppeteer-page-scan';

import path from 'node:path';

import { createChildProcess } from '@d-zero/puppeteer-dealer';

import { pngToPdf } from './modules/png-to-pdf.js';
import { printPdf } from './modules/print-pdf.js';
import { printPng } from './modules/print-png.js';

export type ChildProcessParams = {
	dir: string;
	type: PrintType;
	hooks?: readonly PageHook[];
	devices?: Sizes;
	timeout?: number;
};

createChildProcess<ChildProcessParams>((param) => {
	const { dir, type, hooks, devices, timeout } = param;

	return {
		async eachPage({ page, id, url }, logger) {
			const ext = type === 'pdf' ? 'pdf' : 'png';
			const fileName = `${id}.${ext}`;
			const filePath = path.resolve(dir, fileName);

			if (type === 'pdf') {
				await printPdf(page, url, filePath, logger, hooks, devices, timeout);
				logger('🔚 Closing');
				return;
			}

			const result = await printPng(
				page,
				url,
				id,
				filePath,
				logger,
				hooks,
				devices,
				timeout,
			);

			if (type === 'png') {
				logger('🔚 Closing');
				return;
			}

			await pngToPdf(page, result, logger);
			logger('🔚 Closing');
		},
	};
});
