import type { ScreenshotListener, ScreenshotPhase } from './types.js';

import path from 'node:path';

import c from 'ansi-colors';

export function screenshotListener(update: (log: string) => void): ScreenshotListener {
	return (phase, data) => {
		const sizeLabel = c.bgMagenta(` ${data.name} `);

		switch (phase) {
			case 'setViewport': {
				const { width } = data as ScreenshotPhase['setViewport'];
				update(`${sizeLabel} ↔️ Change viewport size to ${width}px`);
				break;
			}
			case 'load': {
				const { type } = data as ScreenshotPhase['load'];
				update(`${sizeLabel} %earth% ${type === 'open' ? 'Open' : 'Reload'} page`);
				break;
			}
			case 'hook': {
				const { message } = data as ScreenshotPhase['hook'];
				update(`${sizeLabel} ${message}`);
				break;
			}
			case 'scroll': {
				update(`${sizeLabel} %propeller% Scroll the page`);
				break;
			}
			case 'screenshotStart': {
				update(`${sizeLabel} 📸 Take a screenshot`);
				break;
			}
			case 'screenshotSaving': {
				const { path: filePath } = data as ScreenshotPhase['screenshotSaving'];
				const name = path.basename(filePath);
				update(`${sizeLabel} 🖼  Save a file ${name}`);
				break;
			}
			case 'screenshotError': {
				const { error } = data as ScreenshotPhase['screenshotError'];
				update(`${sizeLabel} ❌️ ${error.message}`);
				break;
			}
		}
	};
}
