export type { PageHook } from '@d-zero/puppeteer-page-scan';

import type {
	Listener as ScanListener,
	Phase as ScanPhase,
	Size,
} from '@d-zero/puppeteer-page-scan';

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
} & ScanPhase;

export type ScreenshotListener = ScanListener<ScreenshotPhase>;

/**
 * @deprecated
 */
export type Phase = ScreenshotPhase;

/**
 * @deprecated
 */
export type Listener = ScreenshotListener;
