import type { PageScanPhase } from './types.js';
import type { Loggers } from '@d-zero/puppeteer-general-actions';

import { createListener } from '@d-zero/puppeteer-general-actions';

export const pageScanLoggers: Loggers<PageScanPhase> = (log) => ({
	setViewport: ({ width }) => {
		log(`↔️ Change viewport size to ${width}px`);
	},
	load({ type, timeout, id }) {
		const timeoutSec = Math.floor(timeout / 1000);
		log(
			`%earth% ${type === 'open' ? 'Open' : 'Reload'} page / Timeout: %countdown(${timeout},${id}_timeout,s)%s/${timeoutSec}s`,
		);
	},
	hook({ message }) {
		log(message);
	},
	scroll({ scrollY, scrollHeight, message }) {
		if (Number.isNaN(scrollHeight)) {
			log(`%propeller% ${message}`);
			return;
		}
		log(
			`%propeller% ${scrollY}px/${scrollHeight}px (${Math.round(
				(scrollY / scrollHeight) * 100,
			)}%) ${message}`,
		);
	},
});

export const pageScanListener = createListener<PageScanPhase>((log) => {
	return pageScanLoggers(log);
});
