import type { PrintType } from './types.js';
import type { PageHookSource, Sizes } from '@d-zero/puppeteer-page-scan';
import type { DelayOptions } from '@d-zero/shared/delay';

import path from 'node:path';

import { createChildProcess } from '@d-zero/puppeteer-dealer';
import { readPageHooks } from '@d-zero/puppeteer-page-scan';

import { pngToPdf } from './modules/png-to-pdf.js';
import { printPdf } from './modules/print-pdf.js';
import { printPng } from './modules/print-png.js';

export type ChildProcessParams = {
	dir: string;
	type: PrintType;
	hooks?: PageHookSource;
	devices?: Sizes;
	timeout?: number;
	openDisclosures?: boolean;
	scrollInterval?: number | DelayOptions;
	scrollDistance?: number | DelayOptions;
};

createChildProcess<ChildProcessParams>(async (param) => {
	const {
		dir,
		type,
		hooks: hookSource,
		devices,
		timeout,
		openDisclosures,
		scrollInterval,
		scrollDistance,
	} = param;

	const hooks =
		hookSource && hookSource.paths.length > 0
			? await readPageHooks(hookSource.paths, hookSource.baseDir)
			: undefined;

	return {
		async eachPage({ page, id, url }, logger) {
			const ext = type === 'pdf' ? 'pdf' : 'png';
			const fileName = `${id}.${ext}`;
			const filePath = path.resolve(dir, fileName);

			if (type === 'pdf') {
				await printPdf(
					page,
					url,
					filePath,
					logger,
					hooks,
					devices,
					timeout,
					openDisclosures,
					scrollInterval,
					scrollDistance,
				);
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
				openDisclosures,
				scrollInterval,
				scrollDistance,
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
