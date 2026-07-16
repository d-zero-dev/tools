/**
 * Lightweight scrollHeight measurement without `scrollAllOver`.
 *
 * Used when `captureImages` is false so callers still receive desktop/mobile
 * heights without the cost of full-page scrolling for image extraction.
 * @module
 */

import type { ScrollHeightData } from './types.js';
import type { Page } from 'puppeteer';

import { devicePresets } from '@d-zero/puppeteer-page-scan';

/**
 * Measure `document.body.scrollHeight` at desktop-compact and mobile-small viewports.
 *
 * Sets each viewport, reads height once, and does **not** call `scrollAllOver`.
 * A failed preset yields `null` for that side only.
 * @param page - Puppeteer page whose DOM has finished loading.
 * @returns Heights for desktop and mobile presets.
 * @example
 * ```ts
 * const scrollHeight = await measureScrollHeight(page);
 * // { desktop: 2400, mobile: 5200 }
 * ```
 */
export async function measureScrollHeight(page: Page): Promise<ScrollHeightData> {
	const desktop = await measureAtPreset(page, 'desktop-compact');
	const mobile = await measureAtPreset(page, 'mobile-small');
	return { desktop, mobile };
}

/**
 * @param page
 * @param key
 */
async function measureAtPreset(
	page: Page,
	key: 'desktop-compact' | 'mobile-small',
): Promise<number | null> {
	const preset: { width: number; resolution?: number } = devicePresets[key];
	try {
		await page.setViewport({
			width: preset.width,
			height: 800,
			deviceScaleFactor: preset.resolution ?? 1,
		});
		return await page.evaluate(() => document.body.scrollHeight);
	} catch {
		return null;
	}
}
