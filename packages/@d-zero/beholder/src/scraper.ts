import type {
	ChangePhaseEvent,
	ResourceEntry,
	ScraperEventTypes,
	ScraperOptions,
	ScrapeResult,
	ExURL,
	ImageElement,
	NetworkLog,
	PageData,
	ParseURLOptions,
	Resource,
	SkippedPageData,
} from './types.js';
import type { PageScanPhase } from '@d-zero/puppeteer-page-scan';
import type { Dialog, HTTPRequest, HTTPResponse, Page } from 'puppeteer';

import { beforePageScan, devicePresets } from '@d-zero/puppeteer-page-scan';
import { detectCDN } from '@d-zero/shared/detect-cdn';
import { detectCompress } from '@d-zero/shared/detect-compress';
import { retry as retryable } from '@d-zero/shared/retry';
import { TypedAwaitEventEmitter as EventEmitter } from '@d-zero/shared/typed-await-event-emitter';

import { resourceLog, scraperLog } from './debug.js';
import { getAnchorList, getImageList, getMeta } from './dom-evaluation.js';
import { isError } from './is-error.js';
import { keywordCheck } from './keyword-check.js';
import { findDisconnectionFailures } from './network-disconnection.js';
import { parseUrl } from './parse-url.js';

const pid = `${process.pid}`;
const log = scraperLog.extend(pid);
const rLog = resourceLog.extend(pid);

/**
 * Page-level scraper that extracts data from a single browser page.
 *
 * The scraper returns results as values from `scrapeStart()` rather than
 * emitting them as events. Only streaming events (changePhase, resourceResponse)
 * are emitted for progress monitoring.
 *
 * The Puppeteer `Page` object is injected externally, and page lifecycle
 * (including `page.close()`) is managed by the caller.
 * @example
 * ```ts
 * const scraper = new Scraper();
 * scraper.on('changePhase', (e) => console.log(e.name));
 * const result = await scraper.scrapeStart(page, url, { isExternal: false });
 * ```
 */
// eslint-disable-next-line unicorn/prefer-event-target -- TypedAwaitEventEmitter is a project-specific typed wrapper, not Node.js EventEmitter
export default class Scraper extends EventEmitter<ScraperEventTypes> {
	/** Number of retries for `@retryable`-decorated methods. Set per-scrape from options. */
	retries?: number;
	/** Cleanup function to remove page listeners registered by `#fetchData`. */
	#pageListenerCleanup: (() => void) | null = null;

	/**
	 * Begins the scraping process for a given URL on the provided Puppeteer page.
	 *
	 * Returns a `ScrapeResult` containing the outcome:
	 * - `type: "success"` with `pageData` on success
	 * - `type: "skipped"` with `ignored` details when the page is excluded
	 * - `type: "error"` with `error` details when scraping fails
	 *
	 * Sub-resources are collected via the `resourceResponse` event and
	 * included in the returned `ScrapeResult.resources`.
	 * @param page - The Puppeteer page instance to use for navigation and DOM evaluation.
	 * @param url - The extended URL to scrape.
	 * @param options - Optional scraper configuration overriding defaults.
	 * @param isSkip - When `true`, the page is immediately skipped without any network requests.
	 * @returns The scrape result containing the outcome and captured resources.
	 */
	async scrapeStart(
		page: Page,
		url: ExURL,
		options?: Partial<ScraperOptions>,
		isSkip = false,
	): Promise<ScrapeResult> {
		this.retries = options?.retries;
		const isExternal = options?.isExternal ?? false;
		const captureImages = options?.captureImages ?? true;
		const excludeKeywords = options?.excludeKeywords ?? [];
		const metadataOnly = options?.metadataOnly ?? false;
		const imageLoadTimeout = options?.imageLoadTimeout ?? 5000;
		const resources: ResourceEntry[] = [];
		const failedRequests: Array<{ url: string; errorText: string }> = [];

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'scrapeStart',
			url,
			isExternal,
			message: '',
		});

		// Path-excluded: return SkippedPageData
		if (isSkip) {
			void this.emit('changePhase', {
				pid: process.pid,
				name: 'pageSkipped',
				url,
				isExternal,
				message: 'Matched: excluded path',
			});
			return {
				type: 'skipped',
				resources,
				ignored: {
					url,
					matchedText: url.pathname || '',
					excludeKeywords,
				},
			};
		}

		// Non-HTTP protocol: return minimal PageData
		if (!url.isHTTP) {
			const result: PageData = {
				url,
				isTarget: false,
				isExternal,
				redirectPaths: [],
				status: -1,
				statusText: '__THIS_IS_NOT_HTTP_PROTOCOL__',
				contentType: null,
				contentLength: null,
				responseHeaders: {},
				meta: {
					title: '',
				},
				imageList: [],
				anchorList: [],
				html: '',
				isSkipped: false,
			};

			void this.emit('changePhase', {
				pid: process.pid,
				name: 'scrapeEnd',
				url,
				isExternal,
				message: '',
			});
			return { type: 'success', pageData: result, resources };
		}

		let headResult: PageData | SkippedPageData | null = options?.headCheckResult ?? null;

		if (headResult && metadataOnly) {
			void this.emit('changePhase', {
				pid: process.pid,
				name: 'scrapeEnd',
				url,
				isExternal,
				message: '',
			});
			return {
				type: 'success',
				pageData: {
					...headResult,
					isTarget: false,
				},
				resources,
			};
		}

		if (headResult === null || headResult.contentType === 'text/html') {
			const fetchResult = await this.#fetchData(
				page,
				url,
				isExternal,
				captureImages,
				imageLoadTimeout,
				resources,
				failedRequests,
				options,
			).catch((error) => {
				if (error instanceof Error) {
					return error;
				}
				return new Error(error);
			});

			if (fetchResult instanceof Error) {
				log('Error(FETCH_DATA): %s', url.href);
				this.#cleanupPageListeners();
				return {
					type: 'error',
					resources,
					failedRequests: failedRequests.length > 0 ? failedRequests : undefined,
					error: {
						name: fetchResult.name,
						message: fetchResult.message,
						stack: fetchResult.stack,
						shutdown: true,
					},
				};
			}

			this.#cleanupPageListeners();
			headResult = fetchResult;

			if (!headResult.isSkipped) {
				const checkedKeyword = keywordCheck(headResult.html, excludeKeywords);

				if (checkedKeyword) {
					headResult = {
						url,
						isSkipped: true,
						matched: {
							type: 'keyword',
							text: checkedKeyword,
							excludeKeywords,
						},
					};
				}
			}

			if (headResult.isSkipped) {
				if (headResult.matched.type === 'path') {
					return {
						type: 'skipped',
						resources,
						ignored: {
							url,
							matchedText: url.pathname || '',
							excludeKeywords,
						},
					};
				}
				void this.emit('changePhase', {
					pid: process.pid,
					name: 'pageSkipped',
					url,
					isExternal,
					message: `Matched: "${headResult.matched.text}"`,
				});
				return {
					type: 'skipped',
					resources,
					ignored: {
						url,
						matchedText: headResult.matched.text,
						excludeKeywords,
					},
				};
			}
		}

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'scrapeEnd',
			url,
			isExternal,
			message: '',
		});

		return {
			type: 'success',
			pageData: headResult,
			resources,
			failedRequests: failedRequests.length > 0 ? failedRequests : undefined,
		};
	}
	#cleanupPageListeners() {
		if (this.#pageListenerCleanup) {
			this.#pageListenerCleanup();
			this.#pageListenerCleanup = null;
		}
	}

	/**
	 * Creates a callback for `@d-zero/puppeteer-page-scan`'s `beforePageScan` listener.
	 *
	 * WHY a separate factory: The listener must capture `isExternal` for phase events
	 * while conforming to the `beforePageScan` listener signature.
	 * Currently only handles the `scroll` phase to report scroll progress.
	 * @param isExternal - Whether the current page is external to the crawl scope
	 * @returns A listener function compatible with `beforePageScan`'s `listener` option
	 */
	#createPageScanListener(
		isExternal: boolean,
	): (phase: keyof PageScanPhase, data: PageScanPhase[keyof PageScanPhase]) => void {
		return (phase, data) => {
			switch (phase) {
				case 'scroll': {
					const d = data as PageScanPhase['scroll'];
					const scrollMsg = Number.isNaN(d.scrollHeight)
						? `%propeller% ${d.message}`
						: `%propeller% ${d.scrollY}px/${d.scrollHeight}px (${Math.round((d.scrollY / d.scrollHeight) * 100)}%) ${d.message}`;
					void this.emit('changePhase', {
						pid: process.pid,
						name: 'scrollToBottom',
						url: null,
						isExternal,
						message: scrollMsg,
					} satisfies ChangePhaseEvent);
					break;
				}
			}
		};
	}
	/**
	 * Navigates the page to the target URL and extracts full page data.
	 *
	 * WHY retryable with 3-min timeout: Page navigation can fail due to transient
	 * network issues or slow-loading pages. The decorator retries automatically,
	 * emitting `retryWait` / `retryExhausted` phase events for progress monitoring.
	 *
	 * Flow:
	 * 1. Register request/response/requestfailed listeners to capture sub-resources (internal pages only)
	 * 2. Navigate to URL via `page.goto()` and track redirect chain
	 * 3. Wait for DOM content and network idle
	 * 4. Check for network disconnection errors and throw to trigger retry
	 * 5. Extract anchors, meta, and optionally images
	 * 6. Check for keyword exclusion in HTML content
	 * @param page - Puppeteer page instance
	 * @param url - Target URL to navigate to
	 * @param isExternal - Whether the URL is external to the crawl scope
	 * @param captureImages - Whether to run the image extraction pipeline
	 * @param imageLoadTimeout - Timeout (ms) for waiting lazy-loaded images to complete
	 * @param resources - Mutable array to collect captured sub-resources into
	 * @param failedRequests - Mutable array to collect failed sub-resource requests into
	 * @param options - Additional scraper options (e.g. `disableQueries`, `navigationTimeout`)
	 * @returns Full page data or skipped page data if an exclusion rule matched
	 */
	@retryable({
		timeout: 3 * 60 * 1000,
		onWait(this: Scraper, determinedInterval, retryCount, methodName, error) {
			void this.emit('changePhase', {
				pid: process.pid,
				name: 'retryWait',
				url: null,
				isExternal: false,
				message: `${methodName}: ${error.message} — %countdown(${determinedInterval},${methodName}_${retryCount},s)%s (retry #${retryCount + 1})`,
			});
		},
		onGiveUp(this: Scraper, retryCount, error, methodName) {
			void this.emit('changePhase', {
				pid: process.pid,
				name: 'retryExhausted',
				url: null,
				isExternal: false,
				message: `${methodName}: gave up after ${retryCount} retries — ${error.message}`,
			});
		},
	})
	async #fetchData(
		page: Page,
		url: ExURL,
		isExternal: boolean,
		captureImages: boolean,
		imageLoadTimeout: number,
		resources: ResourceEntry[],
		failedRequests: Array<{ url: string; errorText: string }>,
		options?: Partial<ScraperOptions>,
	): Promise<PageData | SkippedPageData> {
		const parseOpts: ParseURLOptions | undefined =
			options?.disableQueries == null
				? undefined
				: { disableQueries: options.disableQueries };
		const networkLogs: Record<string, NetworkLog> = {};

		// Clear stale state from previous retries (@retryable may re-invoke this method
		// with the same page and mutable arrays, so we must reset to avoid accumulation)
		this.#cleanupPageListeners();
		failedRequests.length = 0;
		resources.length = 0;

		// Define named listeners so they can be individually removed on retry/cleanup
		const onDialog = async (dialog: Dialog) => {
			log(`Appear ${dialog.type()} dialog: ${dialog.message()}`);
			try {
				await dialog.accept();
			} catch (error) {
				log(`Error: ${error}`);
			}
			log(`Accept ${dialog.type()} dialog`);
		};
		page.on('dialog', onDialog);

		let onRequest: ((req: HTTPRequest) => void) | null = null;
		let onResponse: ((res: HTTPResponse) => void) | null = null;
		let onRequestFailed: ((req: HTTPRequest) => void) | null = null;

		if (!isExternal) {
			onRequest = (request: HTTPRequest) => {
				const url = parseUrl(request.url(), parseOpts)!;
				networkLogs[request.url()] = {
					url,
					status: null,
					contentLength: 0,
					contentType: '',
					isError: false,
					request: {
						ts: Date.now(),
						headers: request.headers(),
						method: request.method(),
					},
				};
			};

			const uniqueRes = new Set<string>();
			onResponse = (response: HTTPResponse) => {
				const resURL = parseUrl(response.url(), parseOpts)!;

				if (uniqueRes.has(resURL.withoutHash)) {
					return;
				}
				if (resURL.withoutHash === url.withoutHash) {
					return;
				}
				uniqueRes.add(resURL.withoutHash);

				const headers = response.headers();
				const status = response.status();
				const statusText = response.statusText();
				const contentType = headers['content-type']?.split(';')[0] || null;
				const contentLength =
					Number.parseInt(headers['content-length'] ?? '', 10) || null;
				const request = networkLogs[resURL.withoutHash]!;
				const log: NetworkLog = {
					...request,
					response: {
						ts: Date.now(),
						status,
						statusText,
						fromCache: response.fromCache(),
						headers,
					},
					status,
					isError: isError(status),
					contentType: contentType || '',
					contentLength: contentLength || 0,
				};

				const referredLink: Omit<Resource, 'uid'> = {
					url: resURL,
					isExternal: resURL.hostname !== url.hostname,
					isError: log.isError,
					status,
					statusText,
					contentType,
					contentLength,
					compress: detectCompress(headers),
					cdn: detectCDN(headers),
					headers: headers,
				};

				rLog('Fetched: %s', resURL.href);

				// Collect resource into the results array
				resources.push({ log, resource: referredLink, pageUrl: url.withoutHash });

				// Also emit for streaming consumers
				void this.emit('resourceResponse', {
					pid: process.pid,
					url,
					log,
					resource: referredLink,
				});
			};

			onRequestFailed = (request: HTTPRequest) => {
				const errorText = request.failure()?.errorText ?? 'Unknown error';
				rLog('Request failed: %s (%s)', request.url(), errorText);
				failedRequests.push({ url: request.url(), errorText });
			};

			page.on('request', onRequest);
			page.on('response', onResponse);
			page.on('requestfailed', onRequestFailed);
		}

		// Store cleanup function for retry/post-fetch removal
		this.#pageListenerCleanup = () => {
			page.off('dialog', onDialog);
			if (onRequest) page.off('request', onRequest);
			if (onResponse) page.off('response', onResponse);
			if (onRequestFailed) page.off('requestfailed', onRequestFailed);
		};

		const navigationTimeout = options?.navigationTimeout ?? 60_000;

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'openPage',
			url,
			isExternal,
			message: `%countdown(${navigationTimeout},openPage_${url.withoutHash},s)%s`,
		});

		if (url.username && url.password) {
			await page.setExtraHTTPHeaders({
				Authorization: `Basic ${Buffer.from(`${url.username}:${url.password}`).toString('base64')}`,
			});
		}

		const res = await page.goto(url.withoutHashAndAuth, { timeout: navigationTimeout });

		if (!res) {
			throw new Error('The method Page.goto returned null');
		}

		const destUrl = parseUrl(page.url(), parseOpts)!;
		const redirectPaths = new Set<string>();

		if (url.withoutHash !== destUrl.withoutHash) {
			const redirectChain = res
				.request()
				.redirectChain()
				.map((req) => req.url());
			for (const redirectPath of redirectChain) {
				redirectPaths.add(redirectPath);
			}
			redirectPaths.add(destUrl.withoutHash);
		}

		if (destUrl.hostname !== url.hostname) {
			isExternal = true;
		}

		const status = res.status();
		const statusText = res.statusText();
		const responseHeaders = res.headers();
		const contentType = responseHeaders['content-type']?.split(';')[0] || null;
		const _contentLength = Number.parseInt(responseHeaders['content-length'] ?? '');
		const contentLength = Number.isFinite(_contentLength) ? _contentLength : null;

		if (contentType !== 'text/html') {
			return {
				url,
				isTarget: false,
				isExternal,
				redirectPaths: [...redirectPaths],
				status,
				statusText,
				contentType,
				contentLength,
				responseHeaders,
				meta: {
					title: '',
				},
				imageList: [],
				anchorList: [],
				html: '',
				isSkipped: false,
			};
		}

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'loadDOMContent',
			url,
			isExternal,
			message: '',
		});

		await page
			.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 })
			.catch(() => {});

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'getHTML',
			url,
			isExternal,
			message: '',
		});

		const { title, html } = await page.evaluate(() => {
			/* global document */
			return {
				title: document.title,
				html: document.documentElement.outerHTML,
			};
		});

		if (isExternal) {
			return {
				url,
				isTarget: false,
				isExternal,
				redirectPaths: [...redirectPaths],
				status,
				statusText,
				contentType,
				contentLength,
				responseHeaders,
				meta: {
					title,
				},
				imageList: [],
				anchorList: [],
				html,
				isSkipped: false,
			};
		}

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'waitNetworkIdle',
			url,
			isExternal,
			message: '',
		});

		await page
			.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 })
			.catch(() => {});

		// Check for network disconnection errors in failed requests
		const disconnectionFailures = findDisconnectionFailures(failedRequests);
		if (disconnectionFailures.length > 0) {
			const errorSummary = disconnectionFailures
				.map((r) => `${r.url} (${r.errorText})`)
				.join(', ');
			throw new Error(`Network disconnection detected during page load: ${errorSummary}`);
		}

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'getAnchors',
			url,
			isExternal,
			message: '',
		});
		const anchorList = await getAnchorList(page, parseOpts);

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'getMeta',
			url,
			isExternal,
			message: '',
		});
		const meta = await getMeta(page);

		const imageList = captureImages
			? await (async () => {
					void this.emit('changePhase', {
						pid: process.pid,
						name: 'extractImages',
						url,
						isExternal,
						message: '',
					});
					return this.#fetchImages(
						page,
						url.withoutHashAndAuth,
						isExternal,
						imageLoadTimeout,
					);
				})()
			: [];

		return {
			url,
			isTarget: true,
			isExternal,
			redirectPaths: [...redirectPaths],
			status,
			statusText,
			contentType,
			contentLength,
			responseHeaders,
			meta,
			anchorList,
			imageList,
			html,
			isSkipped: false,
		};
	}
	/**
	 * Extracts image data from the page across multiple device presets.
	 *
	 * WHY multiple device presets: Images may differ between desktop and mobile
	 * due to responsive `<picture>` / `srcset`. Capturing both `desktop-compact`
	 * and `mobile-small` viewports reveals responsive image issues.
	 *
	 * WHY per-device try-catch: Some pages (e.g. those using fullpage.js or
	 * scroll-jacking libraries) destroy the execution context when the viewport
	 * changes and triggers a reload. Isolating each device preset allows partial
	 * results — if one viewport fails, the other can still succeed.
	 *
	 * WHY retryable with 5-min timeout and `fallback: []`: Image extraction is
	 * best-effort. If all retries fail, an empty array is returned rather than
	 * failing the entire page scrape.
	 * @param page - Puppeteer page instance
	 * @param url - The page URL string (without hash and auth)
	 * @param isExternal - Whether the page is external
	 * @param imageLoadTimeout - Timeout (ms) for waiting images to complete loading
	 * @returns Array of image elements from all device presets (may be partial if some viewports failed)
	 */
	@retryable({
		timeout: 5 * 60 * 1000,
		fallback: [],
		onWait(this: Scraper, determinedInterval, retryCount, methodName, error) {
			void this.emit('changePhase', {
				pid: process.pid,
				name: 'retryWait',
				url: null,
				isExternal: false,
				message: `${methodName}: ${error.message} — %countdown(${determinedInterval},${methodName}_${retryCount},s)%s (retry #${retryCount + 1} / images)`,
			});
		},
		onGiveUp(this: Scraper, retryCount, error, methodName) {
			void this.emit('changePhase', {
				pid: process.pid,
				name: 'retryExhausted',
				url: null,
				isExternal: false,
				message: `${methodName}: gave up after ${retryCount} retries — ${error.message}`,
			});
		},
	})
	async #fetchImages(
		page: Page,
		url: string,
		isExternal: boolean,
		imageLoadTimeout: number,
	): Promise<ImageElement[]> {
		const listener = this.#createPageScanListener(isExternal);
		const devices: { key: string; preset: { width: number; resolution?: number } }[] = [
			{ key: 'desktop-compact', preset: devicePresets['desktop-compact'] },
			{ key: 'mobile-small', preset: devicePresets['mobile-small'] },
		];
		const imageList: ImageElement[] = [];

		for (const { key, preset } of devices) {
			try {
				void this.emit('changePhase', {
					pid: process.pid,
					name: 'setViewport',
					url: null,
					isExternal,
					message: `📷 ${key} ↔️ ${preset.width}px`,
				});

				await beforePageScan(page, url, {
					name: key,
					width: preset.width,
					resolution: preset.resolution,
					listener,
					timeout: 5000,
				});

				void this.emit('changePhase', {
					pid: process.pid,
					name: 'waitImageLoad',
					url: null,
					isExternal,
					message: `📷 ${key}: Waiting for images%dots%`,
				});

				await page
					.waitForFunction(() => [...document.images].every((img) => img.complete), {
						timeout: imageLoadTimeout,
					})
					.catch(() => {});

				void this.emit('changePhase', {
					pid: process.pid,
					name: 'getImages',
					url: null,
					isExternal,
					message: `📸 ${key}: Extracting images%dots%`,
				});
				const images = await getImageList(page, preset.width);
				imageList.push(...images);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				log('Error(FETCH_IMAGES/%s): %s', key, errorMessage);
				void this.emit('changePhase', {
					pid: process.pid,
					name: 'retryExhausted',
					url: null,
					isExternal: false,
					message: `📷 ${key}: skipped — ${errorMessage}`,
				});
			}
		}

		return imageList;
	}
}
