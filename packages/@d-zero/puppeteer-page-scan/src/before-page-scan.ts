import type { PageHook, PageScanPhase, Size } from './types.js';
import type { Listener } from '@d-zero/puppeteer-general-actions';
import type { Page } from '@d-zero/puppeteer-page';

import { scrollAllOver } from '@d-zero/puppeteer-scroll';

type Options = {
	name: string;
	hooks?: readonly PageHook[];
	listener?: Listener<PageScanPhase>;
} & Size;

export async function beforePageScan(page: Page, url: string, options?: Options) {
	const listener = options?.listener;
	const name = options?.name ?? 'default';
	const width = options?.width ?? 1400;
	const resolution = options?.resolution;

	listener?.('setViewport', { name, width, resolution });
	await page.setViewport({
		width,
		height:
			// Landscape or portrait
			width > 1000 ? Math.floor(width * 0.75) : Math.floor(width * 1.5),
		deviceScaleFactor: resolution ?? 1,
	});

	if ((await page.url()) === url) {
		listener?.('load', { name, type: 'reaload' });
		await page.reload({ waitUntil: 'networkidle0' });
	} else {
		listener?.('load', { name, type: 'open' });
		await page.goto(url, { waitUntil: 'networkidle0' });
	}

	for (const hook of options?.hooks ?? []) {
		await hook(page, {
			name,
			width,
			resolution,
			log: (message) => listener?.('hook', { name, message }),
		});
	}

	listener?.('scroll', {
		name,
		scrollY: 0,
		scrollHeight: Number.NaN,
		message: 'Start scrolling',
	});
	await scrollAllOver(page, {
		logger: (scrollY, scrollHeight, message) =>
			listener?.('scroll', { name, scrollY, scrollHeight, message }),
	});
}
