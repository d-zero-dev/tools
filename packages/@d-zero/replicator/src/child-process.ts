import type { ChildProcessInput, ChildProcessResult } from './types.js';
import type { HTTPResponse } from 'puppeteer';

import { createChildProcess } from '@d-zero/puppeteer-dealer';
import { beforePageScan, devicePresets } from '@d-zero/puppeteer-page-scan';
import { scrollAllOver } from '@d-zero/puppeteer-scroll';

createChildProcess<ChildProcessInput, ChildProcessResult>((param) => {
	const { devices, timeout } = param;

	return {
		async eachPage({ page, url }, logger) {
			const resourceUrls = new Set<string>();

			// Listen to all network responses
			const responseHandler = (response: HTTPResponse) => {
				const responseUrl = response.url();

				// Skip data URLs
				if (responseUrl.startsWith('data:')) {
					return;
				}

				// For URLs not ending with '/', add as-is
				if (!responseUrl.endsWith('/')) {
					resourceUrls.add(responseUrl);
					return;
				}

				// For URLs ending with '/', encode with MIME type
				const contentType = response.headers()['content-type'];
				const mimeType = contentType?.split(';')[0]?.trim();
				if (mimeType) {
					resourceUrls.add(`${responseUrl}:::${mimeType}`);
					return;
				}

				resourceUrls.add(responseUrl);
			};

			page.on('response', responseHandler);

			const defaultSizes = {
				'desktop-compact': devicePresets['desktop-compact'],
				mobile: devicePresets.mobile,
			};

			const targetSizes = devices ?? defaultSizes;

			// Scan the page across all device sizes
			for (const [sizeName, size] of Object.entries(targetSizes)) {
				logger(`📱 Scanning with ${sizeName} (${size.width}px)`);

				await beforePageScan(page, url, {
					name: sizeName,
					width: size.width,
					timeout,
				}).catch((error) => {
					logger(`❌ Failed to scan ${sizeName}: ${error.message}`);
					throw error;
				});

				// Scroll to load lazy resources
				await scrollAllOver(page).catch((error) => {
					logger(`❌ Failed to scroll ${sizeName}: ${error.message}`);
					throw error;
				});
			}

			page.off('response', responseHandler);

			logger(`📦 Collected ${resourceUrls.size} resources`);

			return {
				url,
				encodedUrls: [...resourceUrls],
			};
		},
	};
});
