export type { PageHook } from '@d-zero/puppeteer-page-scan';

import type { Listener as GeneralListener } from '@d-zero/puppeteer-general-actions';
import type { PageScanPhase, Size } from '@d-zero/puppeteer-page-scan';

export type Screenshot = {
	id: string;
	filePath: string | null;
	url: string;
	title: string;
	binary: Uint8Array | null;
	dom: string;
	text: {
		textContent: string;
		altTextList: readonly string[];
	};
} & Size;

export type ScreenshotPhase = {
	screenshotStart: { name: string; selector?: string };
	screenshotEnd: { name: string; binary: Uint8Array };
	screenshotSaving: { name: string; path: string; selector?: string };
	screenshotError: { name: string; error: Error };
	getDOMStart: { name: string; selector?: string };
	getDOMEnd: { name: string; dom: string };
} & PageScanPhase;

/**
 * @deprecated
 */
export type ScreenshotListener = GeneralListener<ScreenshotPhase>;

/**
 * @deprecated
 */
export type Phase = ScreenshotPhase;

/**
 * @deprecated
 */
export type Listener = ScreenshotListener;
