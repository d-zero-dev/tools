import type { PageScanPhase } from './types.js';
import type { Loggers } from '@d-zero/puppeteer-general-actions';

import { createListener } from '@d-zero/puppeteer-general-actions';

export const pageScanLoggers: Loggers<PageScanPhase> = (log) => ({
	setViewport: ({ width }) => {
		log(`↔️ Change viewport size to ${width}px`);
	},
	load({ type }) {
		log(`%earth% ${type === 'open' ? 'Open' : 'Reload'} page`);
	},
	hook({ message }) {
		log(message);
	},
	scroll() {
		log(`%propeller% Scroll the page`);
	},
});

export const pageScanListener = createListener<PageScanPhase>((log) => {
	return pageScanLoggers(log);
});
