import type { ChildProcessInput, ChildProcessResult } from './types.js';
import type { HTTPResponse } from 'puppeteer';

import { createChildProcess } from '@d-zero/puppeteer-dealer';
import { beforePageScan, devicePresets } from '@d-zero/puppeteer-page-scan';
import { scrollAllOver } from '@d-zero/puppeteer-scroll';
import { encodeResourcePath } from '@d-zero/shared/encode-resource-path';

createChildProcess<ChildProcessInput, ChildProcessResult>((param) => {
	const { devices, timeout, username, password } = param;

	return {
		async eachPage({ page, url }, logger) {
			const resourcePaths = new Set<string>();
			const pageHostname = new URL(url).hostname;

			// Add the page URL itself first (in case response event is missed)
			const pageUrlObj = new URL(url);
			resourcePaths.add(encodeResourcePath(pageUrlObj, 'text/html'));

			// Listen to all network responses
			const responseHandler = (response: HTTPResponse) => {
				const responseUrl = response.url();

				// Skip data URLs
				if (responseUrl.startsWith('data:')) {
					return;
				}

				// Skip non-GET requests (POST, PUT, etc. cannot be replicated)
				if (response.request().method() !== 'GET') {
					return;
				}

				// Skip non-successful responses (not 2xx)
				if (response.status() < 200 || response.status() >= 300) {
					return;
				}

				const resourceUrlObj = new URL(responseUrl);

				// Skip different domain resources
				if (resourceUrlObj.hostname !== pageHostname) {
					return;
				}

				// Get MIME type
				const contentType = response.headers()['content-type'];
				const mimeType = contentType?.split(';')[0]?.trim();

				// Add resource with MIME encoding if needed
				resourcePaths.add(encodeResourcePath(resourceUrlObj, mimeType));
			};

			page.on('response', responseHandler);

			if (username && password) {
				await page.authenticate({ username, password });
			}

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

			logger(`📦 Collected ${resourcePaths.size} resources`);

			return {
				url,
				encodedUrls: [...resourcePaths],
			};
		},
	};
});
