import type { Sizes } from '@d-zero/puppeteer-page-scan';
import type { PageHook } from '@d-zero/puppeteer-screenshot';
import type { DelayOptions } from '@d-zero/shared/delay';
import type { Page } from 'puppeteer';

import { devicePresets } from '@d-zero/puppeteer-page-scan';
import { screenshot, screenshotListener } from '@d-zero/puppeteer-screenshot';

/**
 * ページをPNG画像として保存します。
 * @param page
 * @param url
 * @param fileId
 * @param filePath
 * @param update
 * @param hooks
 * @param devices
 * @param timeout
 * @param openDisclosures
 * @param scrollInterval - ページ内スクロールのステップ間隔（ms）。`@d-zero/puppeteer-scroll`の`interval`にそのまま渡されます。省略時はランダム 200-500ms。
 * @param scrollDistance - 1ステップで進むスクロール距離（px）。省略時はビューポート高さの 50-100% のランダム。
 */
export function printPng(
	page: Page,
	url: string,
	fileId: string,
	filePath: string,
	update: (log: string) => void,
	hooks?: readonly PageHook[],
	devices?: Sizes,
	timeout?: number,
	openDisclosures?: boolean,
	scrollInterval?: number | DelayOptions,
	scrollDistance?: number | DelayOptions,
) {
	const defaultSizes = {
		'desktop-compact': devicePresets['desktop-compact'],
		mobile: devicePresets.mobile,
	};

	return screenshot(page, url, {
		id: fileId,
		path: filePath,
		sizes: devices ?? defaultSizes,
		listener: screenshotListener(update),
		hooks,
		timeout,
		openDisclosures,
		scrollInterval,
		scrollDistance,
	});
}
