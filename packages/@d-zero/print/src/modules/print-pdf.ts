import type { PageHook, Sizes } from '@d-zero/puppeteer-page-scan';
import type { Page } from 'puppeteer';

import {
	beforePageScan,
	pageScanListener,
	devicePresets,
} from '@d-zero/puppeteer-page-scan';

/**
 *
 * @param page
 * @param url
 * @param filePath
 * @param update
 * @param hooks
 * @param devices
 */
export async function printPdf(
	page: Page,
	url: string,
	filePath: string,
	update: (log: string) => void,
	hooks?: readonly PageHook[],
	devices?: Sizes,
) {
	// Use the first desktop device or fallback to desktop preset
	const defaultWidth = devicePresets.desktop.width;
	let pdfWidth: number = defaultWidth;

	if (devices) {
		// Find the first desktop-like device (width >= 1000) or use the first device
		const desktopDevice = Object.values(devices).find((device) => device.width >= 1000);
		if (desktopDevice) {
			pdfWidth = desktopDevice.width;
		} else if (Object.values(devices).length > 0) {
			const firstDevice = Object.values(devices)[0];
			if (firstDevice) {
				pdfWidth = firstDevice.width;
			}
		}
	}

	await beforePageScan(page, url, {
		name: 'pdf',
		width: pdfWidth,
		listener: pageScanListener(update),
		hooks,
	});

	update('📄 Save as PDF');

	await page.pdf({
		path: filePath,
		timeout: 30_000 * 10,
		format: 'A4',
		printBackground: true,
		displayHeaderFooter: false,
	});
}
