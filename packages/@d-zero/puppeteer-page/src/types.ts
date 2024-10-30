import type { AxeResults, Spec } from 'axe-core';
import type { Page, ScreenshotOptions } from 'puppeteer';

export type ExtendedPageInterface = Page & {
	axe?: (config: Spec) => Promise<AxeResults>;
	elementScreenshot?: <O extends ScreenshotOptions & { encode?: 'base64' }>(
		selector: string,
		options?: O,
	) => O extends ScreenshotOptions & { encode: 'base64' }
		? Promise<string | null>
		: Promise<Uint8Array | null>;
};
