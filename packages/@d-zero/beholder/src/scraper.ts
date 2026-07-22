import type {
	ChangePhaseEvent,
	ConsoleLogEntry,
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
	ScrollHeightData,
	SkippedPageData,
} from './types.js';
import type { PageScanPhase } from '@d-zero/puppeteer-page-scan';
import type { ConsoleMessage, Dialog, HTTPRequest, HTTPResponse, Page } from 'puppeteer';

import { beforePageScan, devicePresets } from '@d-zero/puppeteer-page-scan';
import { detectCDN } from '@d-zero/shared/detect-cdn';
import { detectCompress } from '@d-zero/shared/detect-compress';
import { retry as retryable } from '@d-zero/shared/retry';
import { TypedAwaitEventEmitter as EventEmitter } from '@d-zero/shared/typed-await-event-emitter';

import { resourceLog, scraperLog } from './debug.js';
import {
	DEFAULT_DOM_EVALUATION_TIMEOUT,
	getAnchorList,
	getImageList,
	getMeta,
} from './dom-evaluation.js';
import { getMainContents } from './get-main-contents.js';
import { isError } from './is-error.js';
import { isHtmlContentType } from './is-html-content-type.js';
import { keywordCheck } from './keyword-check.js';
import { measureScrollHeight } from './measure-scroll-height.js';
import { emptyMeta } from './meta/classify.js';
import { findDisconnectionFailures } from './network-disconnection.js';
import { parseUrl } from './parse-url.js';
import { toConsoleLogEntry } from './to-console-log-entry.js';
import { toPageErrorEntry } from './to-page-error-entry.js';

const pid = `${process.pid}`;
const log = scraperLog.extend(pid);
const rLog = resourceLog.extend(pid);

/**
 * Upper bound for `document.body.scrollHeight` tolerated by `#fetchImages`.
 * Pages exceeding this at a given device preset are skipped to keep
 * `scrollAllOver` from running long enough to outlast the @retryable
 * timeout and collide with a follow-up retry on the same Puppeteer page.
 *
 * 1,000,000 px is roughly 3× the worst real-world value we have measured
 * (a responsive data-table page reached ~321k px at 320px viewport), so
 * normal responsive sites complete well within the 20 min retry budget.
 */
const MAX_SCROLL_HEIGHT = 1_000_000;

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
	 * included in the returned `ScrapeResult.resources`. Console messages and
	 * uncaught page errors (internal pages only) are collected via
	 * Puppeteer's `console`/`pageerror` page events and included in
	 * `ScrapeResult.consoleLogs`.
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
		const consoleLogs: ConsoleLogEntry[] = [];
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
				consoleLogs,
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
				meta: emptyMeta(),
				imageList: [],
				anchorList: [],
				html: '',
				mainContents: null,
				scrollHeight: null,
				isSkipped: false,
			};

			void this.emit('changePhase', {
				pid: process.pid,
				name: 'scrapeEnd',
				url,
				isExternal,
				message: '',
			});
			return { type: 'success', pageData: result, resources, consoleLogs };
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
					mainContents: headResult.mainContents ?? null,
					scrollHeight: headResult.scrollHeight ?? null,
				},
				resources,
				consoleLogs,
			};
		}

		if (headResult === null || isHtmlContentType(headResult.contentType)) {
			const fetchResult = await this.#fetchData(
				page,
				url,
				isExternal,
				captureImages,
				imageLoadTimeout,
				resources,
				consoleLogs,
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
					consoleLogs,
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
						consoleLogs,
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
					consoleLogs,
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
			consoleLogs,
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
	 * WHY retryable with 25-min timeout: Page navigation can fail due to
	 * transient network issues or slow-loading pages. The decorator retries
	 * automatically, emitting `retryWait` / `retryExhausted` phase events for
	 * progress monitoring. The timeout must accommodate the worst-case
	 * `#fetchImages` runtime (its own @retryable allows up to 20 min for
	 * pages with very large `scrollHeight` at narrow viewports). A shorter
	 * `#fetchData` timeout would race `#fetchImages` to completion: when the
	 * outer race fires first, `Promise.race` does not cancel the inner
	 * `#fetchImages`, so a new `#fetchData` retry starts while the previous
	 * attempt's scroll evaluates are still running on the same page —
	 * exactly the collision that surfaces as "Attempted to use detached
	 * Frame" or "Session closed".
	 *
	 * Flow:
	 * 1. Register request/response/requestfailed/console/pageerror listeners to
	 *    capture sub-resources and console output (internal pages only)
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
	 * @param consoleLogs - Mutable array to collect captured console messages / page errors into
	 * @param failedRequests - Mutable array to collect failed sub-resource requests into
	 * @param options - Additional scraper options (e.g. `disableQueries`, `navigationTimeout`)
	 * @returns Full page data or skipped page data if an exclusion rule matched
	 */
	@retryable({
		timeout: 25 * 60 * 1000,
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
		consoleLogs: ConsoleLogEntry[],
		failedRequests: Array<{ url: string; errorText: string }>,
		options?: Partial<ScraperOptions>,
	): Promise<PageData | SkippedPageData> {
		const parseOpts: ParseURLOptions | undefined =
			options?.disableQueries == null
				? undefined
				: { disableQueries: options.disableQueries };
		const domEvaluationTimeout =
			options?.domEvaluationTimeout ?? DEFAULT_DOM_EVALUATION_TIMEOUT;
		const networkLogs: Record<string, NetworkLog> = {};
		// Tracks in-flight `toConsoleLogEntry()` resolutions (async `jsonValue()`
		// extraction) so callers can await them before reading `consoleLogs`.
		const pendingConsoleWork: Promise<void>[] = [];

		// Clear stale state from previous retries (@retryable may re-invoke this method
		// with the same page and mutable arrays, so we must reset to avoid accumulation)
		this.#cleanupPageListeners();
		failedRequests.length = 0;
		resources.length = 0;
		consoleLogs.length = 0;

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
		let onConsole: ((msg: ConsoleMessage) => void) | null = null;
		let onPageError: ((error: unknown) => void) | null = null;

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

			onConsole = (msg: ConsoleMessage) => {
				pendingConsoleWork.push(
					toConsoleLogEntry(msg, url.withoutHash).then(
						(entry) => {
							consoleLogs.push(entry);
						},
						(error) => {
							// A single malformed console message must not fail the whole
							// scrape (e.g. mid-navigation execution-context teardown).
							log('Error(CONSOLE_LOG): %s', error);
						},
					),
				);
			};

			onPageError = (error: unknown) => {
				consoleLogs.push(toPageErrorEntry(error, url.withoutHash));
			};

			page.on('request', onRequest);
			page.on('response', onResponse);
			page.on('requestfailed', onRequestFailed);
			page.on('console', onConsole);
			page.on('pageerror', onPageError);
		}

		// Store cleanup function for retry/post-fetch removal
		this.#pageListenerCleanup = () => {
			page.off('dialog', onDialog);
			if (onRequest) page.off('request', onRequest);
			if (onResponse) page.off('response', onResponse);
			if (onRequestFailed) page.off('requestfailed', onRequestFailed);
			if (onConsole) page.off('console', onConsole);
			if (onPageError) page.off('pageerror', onPageError);
		};

		const navigationTimeout = options?.navigationTimeout ?? 60_000;

		// The whole navigation/extraction sequence below is wrapped in `finally`
		// so that `pendingConsoleWork` is always awaited exactly once — on every
		// return AND on every throw (e.g. `Page.goto returned null`, network
		// disconnection). A per-return-statement `await` would miss thrown exits
		// and let a still-resolving `toConsoleLogEntry()` push into `consoleLogs`
		// after a `@retryable` retry has already cleared it for a new attempt.
		try {
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

			if (!isHtmlContentType(contentType)) {
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
					meta: emptyMeta(),
					imageList: [],
					anchorList: [],
					html: '',
					mainContents: null,
					scrollHeight: null,
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
				const externalMeta = emptyMeta();
				externalMeta.title = title;
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
					meta: externalMeta,
					imageList: [],
					anchorList: [],
					html,
					mainContents: null,
					scrollHeight: null,
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
				throw new Error(
					`Network disconnection detected during page load: ${errorSummary}`,
				);
			}

			const mainContents = await getMainContents(page, {
				mainContentSelector: options?.mainContentSelector,
			});

			void this.emit('changePhase', {
				pid: process.pid,
				name: 'getAnchors',
				url,
				isExternal,
				message: `%countdown(${domEvaluationTimeout},getAnchors_${url.withoutHash},s)%s`,
			});
			const anchorList = await getAnchorList(page, parseOpts, domEvaluationTimeout);

			void this.emit('changePhase', {
				pid: process.pid,
				name: 'getMeta',
				url,
				isExternal,
				message: `%countdown(${domEvaluationTimeout},getMeta_${url.withoutHash},s)%s`,
			});
			const meta = await getMeta(
				page,
				{
					url: url.withoutHashAndAuth,
					html,
					statusCode: status,
					headers: responseHeaders ?? undefined,
				},
				domEvaluationTimeout,
			);

			let imageList: ImageElement[] = [];
			let scrollHeight: ScrollHeightData | null = null;

			if (captureImages) {
				void this.emit('changePhase', {
					pid: process.pid,
					name: 'extractImages',
					url,
					isExternal,
					message: `%countdown(${domEvaluationTimeout},extractImages_${url.withoutHash},s)%s`,
				});
				const fetched = await this.#fetchImages(
					page,
					url.withoutHashAndAuth,
					isExternal,
					imageLoadTimeout,
					domEvaluationTimeout,
				);
				imageList = fetched.imageList;
				scrollHeight = fetched.scrollHeight;
			} else {
				scrollHeight = await measureScrollHeight(page);
			}

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
				mainContents,
				scrollHeight,
				isSkipped: false,
			};
		} finally {
			await Promise.all(pendingConsoleWork);
		}
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
	 * WHY retryable with 20-min timeout and empty fallback: Image extraction is
	 * best-effort. If all retries fail, empty images and null scroll heights are
	 * returned rather than failing the entire page scrape. The 20-min wall clock
	 * accommodates pages whose mobile-small `scrollHeight` reaches ~300k px
	 * (observed on responsive data tables, which take ~5 min to scroll). A shorter
	 * timeout causes a second retry to start while the previous attempt's
	 * `scrollAllOver` is still running its `page.evaluate` calls in the
	 * background — `Promise.race` in `retry.ts` does not cancel `fn()`. The
	 * collision then surfaces as "Attempted to use detached Frame" or
	 * "Session closed" when the new attempt's reload / setViewport runs on
	 * the same page as the old attempt's pending evaluates.
	 *
	 * WHY pass `maxScrollHeight`: Even 20 min is not enough for pathological
	 * pages whose layout explodes at narrow viewports. Skipping the device
	 * preset entirely keeps the timeout-vs-background-evaluate collision from
	 * ever being triggered, at the cost of losing that viewport's image data
	 * for those pages. See {@link MAX_SCROLL_HEIGHT} for the chosen threshold.
	 *
	 * Scroll heights are still recorded when scrolling is skipped for the
	 * height limit — the measurement from `beforePageScan` is kept.
	 * @param page - Puppeteer page instance
	 * @param url - The page URL string (without hash and auth)
	 * @param isExternal - Whether the page is external
	 * @param imageLoadTimeout - Timeout (ms) for waiting images to complete loading
	 * @param domEvaluationTimeout - Timeout (ms) for the in-page image extraction `page.evaluate`
	 * @returns Image elements plus desktop/mobile scroll heights from the scan path
	 */
	@retryable({
		timeout: 20 * 60 * 1000,
		fallback: {
			imageList: [],
			scrollHeight: { desktop: null, mobile: null },
		},
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
		domEvaluationTimeout: number,
	): Promise<{ imageList: ImageElement[]; scrollHeight: ScrollHeightData }> {
		const listener = this.#createPageScanListener(isExternal);
		const devices: {
			key: 'desktop-compact' | 'mobile-small';
			preset: { width: number; resolution?: number };
		}[] = [
			{ key: 'desktop-compact', preset: devicePresets['desktop-compact'] },
			{ key: 'mobile-small', preset: devicePresets['mobile-small'] },
		];
		const imageList: ImageElement[] = [];
		const scrollHeight: ScrollHeightData = { desktop: null, mobile: null };

		for (const { key, preset } of devices) {
			const scrollKey = key === 'desktop-compact' ? 'desktop' : 'mobile';
			try {
				void this.emit('changePhase', {
					pid: process.pid,
					name: 'setViewport',
					url: null,
					isExternal,
					message: `📷 ${key} ↔️ ${preset.width}px`,
				});

				const scanResult = await beforePageScan(page, url, {
					name: key,
					width: preset.width,
					resolution: preset.resolution,
					listener,
					timeout: 5000,
					maxScrollHeight: MAX_SCROLL_HEIGHT,
				});

				scrollHeight[scrollKey] = scanResult.scrollHeight;

				if (!scanResult.scrolled) {
					void this.emit('changePhase', {
						pid: process.pid,
						name: 'retryExhausted',
						url: null,
						isExternal: false,
						message: `📷 ${key}: skipped — scrollHeight ${scanResult.scrollHeight} exceeds limit ${MAX_SCROLL_HEIGHT}`,
					});
					continue;
				}

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
				const images = await getImageList(page, preset.width, domEvaluationTimeout);
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

		return { imageList, scrollHeight };
	}
}
