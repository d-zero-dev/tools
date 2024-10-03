import type { Listener, PageHook, Phase, Size } from './types.js';
import type { Page } from 'puppeteer';

import { scrollAllOver } from '@d-zero/puppeteer-scroll';

type Options = {
	name: string;
	hooks?: readonly PageHook[];
	listener?: Listener<Phase>;
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

	if (page.url() === url) {
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

	listener?.('scroll', { name });
	await scrollAllOver(page);
}
