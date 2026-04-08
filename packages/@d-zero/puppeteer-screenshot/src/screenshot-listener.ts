import type { ScreenshotPhase } from './types.js';

import path from 'node:path';

import { createListener } from '@d-zero/puppeteer-general-actions';
import { pageScanLoggers } from '@d-zero/puppeteer-page-scan';

export const screenshotListener = createListener<ScreenshotPhase>((log) => {
	return {
		...pageScanLoggers(log),
		screenshotStart({ selector }) {
			log(`📸 Take a screenshot` + (selector ? ` for ${selector}` : ''));
		},
		screenshotSaving({ path: filePath, selector }) {
			const name = path.basename(filePath);
			log(`🖼  Save a file ${name}` + (selector ? ` for ${selector}` : ''));
		},
		screenshotError({ error }) {
			log(`❌️ ${error.message}`);
		},
	};
});
