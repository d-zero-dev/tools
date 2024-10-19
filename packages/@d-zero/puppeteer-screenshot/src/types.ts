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
} & Size;

export type ScreenshotPhase = {
	screenshotStart: { name: string };
	screenshotEnd: { name: string; binary: Uint8Array };
	screenshotSaving: { name: string; path: string };
	screenshotError: { name: string; error: Error };
	getDOMStart: { name: string };
	getDOMEnd: { name: string; dom: string };
} & PageScanPhase;

export type ScreenshotListener = GeneralListener<ScreenshotPhase>;

/**
 * @deprecated
 */
export type Phase = ScreenshotPhase;

/**
 * @deprecated
 */
export type Listener = ScreenshotListener;
