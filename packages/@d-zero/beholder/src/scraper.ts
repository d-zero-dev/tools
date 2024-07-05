import type {
	ScrapeEventTypes,
	ImageElement,
	NetworkLog,
	PageData,
	ParseURLOptions,
	Resource,
	SkippedPageData,
	ExURL,
} from './types.js';
import type { Browser, Page } from 'puppeteer';

import { retry } from '@d-zero/shared/retry';
import { TypedAwaitEventEmitter } from '@d-zero/shared/typed-await-event-emitter';
import puppeteer from 'puppeteer';

import { resourceLog, scraperLog } from './debug.js';
import { getAnchorList, getImageList, getMeta } from './dom-evaluation.js';
import { fetchDestination } from './fetch-destination.js';
import { keywordCheck } from './keyword-check.js';
import { detectCDN, detectCompress, isError, parseUrl } from './utils.js';

const pid = `${process.pid}`;
const log = scraperLog.extend(pid);
const rLog = resourceLog.extend(pid);

const LAUNCH_BROWSER_TIMEOUT = 1000 * 30;

export type ScraperOptions = {
	isExternal: boolean;
	isGettingImages: boolean;
	excludeKeywords: string[];
	executablePath: string | null;
	isTitleOnly: boolean;
	screenshot: string | null;
} & ParseURLOptions;

export default class Scraper extends TypedAwaitEventEmitter<ScrapeEventTypes> {
	#browser: Browser | null = null;
	#url: ExURL | null = null;

	async destroy(isExternal: boolean) {
		log('Scraper destroys self');
		if (!this.#url) {
			throw new Error('The instance is already destroyed.');
		}
		if (!this.#browser) {
			void this.emit('destroyed', {
				pid: process.pid,
			});
			void this.emit('changePhase', {
				pid: process.pid,
				name: 'destroyed',
				url: this.#url,
				isExternal,
				message: '',
			});
			return;
		}
		while (!this.#browser.isConnected()) {
			log('Browser closes all pages');
			const pages = await this.#browser.pages();
			for (const page of pages) {
				page.removeAllListeners();
				if (!page.isClosed) {
					await page.close();
				}
			}
			log('Browser closes self');
			await this.#browser.close();
			log('Browser disconnects');
			await this.#browser.disconnect();
		}
		log('Scraper discards browser');
		this.#browser = null;
		void this.emit('destroyed', {
			pid: process.pid,
		});
		void this.emit('changePhase', {
			pid: process.pid,
			name: 'destroyed',
			url: this.#url,
			isExternal,
			message: '',
		});
	}

	async scrapeStart(url: ExURL, options?: Partial<ScraperOptions>, isSkip = false) {
		const isExternal = options?.isExternal ?? false;
		const isGettingImages = options?.isGettingImages ?? true;
		const excludeKeywords = options?.excludeKeywords ?? [];
		const executablePath = options?.executablePath ?? null;
		const isTitleOnly = options?.isTitleOnly ?? false;

		this.#url = url;
		void this.emit('changePhase', {
			pid: process.pid,
			name: 'scrapeStart',
			url: this.#url,
			isExternal,
			message: '',
		});

		if (isSkip) {
			void this.emit('ignoreAndSkip', {
				pid: process.pid,
				url: this.#url,
				reason: {
					matchedText: this.#url.pathname || '',
					excludeKeywords,
				},
			});
			void this.emit('changePhase', {
				pid: process.pid,
				name: 'ignoreAndSkip',
				url: this.#url,
				isExternal,
				message: 'Matched: excluded path',
			});
			return;
		}

		if (!this.#url.isHTTP) {
			const result: PageData = {
				url: this.#url,
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

			void this.emit('scrapeEnd', {
				pid: process.pid,
				url: this.#url,
				timestamp: Date.now(),
				result,
			});

			void this.emit('changePhase', {
				pid: process.pid,
				name: 'scrapeEnd',
				url: this.#url,
				isExternal,
				message: '',
			});
			return;
		}

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'touchHead',
			url: this.#url,
			isExternal,
			message: '',
		});

		let result: PageData | SkippedPageData | Error | null = await this.#fetchHead(
			url,
			isExternal,
		);

		if (result instanceof Error) {
			log('Error(FETCH_HEAD): %s', url.href);
			void this.emit('error', {
				pid: process.pid,
				url: this.#url,
				shutdown: false,
				error: result,
			});
			result = null;
		}

		if (result && isTitleOnly) {
			void this.emit('scrapeEnd', {
				pid: process.pid,
				url: this.#url,
				timestamp: Date.now(),
				result: {
					...result,
					isTarget: false,
				},
			});
			return;
		}

		if (result === null || result.contentType === 'text/html') {
			const headlessMode: true | 'shell' = url.isSecure ? true : 'shell';
			const page = await this.#createPage(isExternal, executablePath, headlessMode);

			result = await this.#fetchData(
				page,
				url,
				isExternal,
				isGettingImages,
				options,
			).catch((error) => {
				if (error instanceof Error) {
					return error;
				}
				return new Error(error);
			});

			if (result instanceof Error) {
				log('Error(FETCH_DATA): %s', url.href);
				void this.emit('error', {
					pid: process.pid,
					url: this.#url,
					shutdown: true,
					error: result,
				});
				await this.destroy(isExternal);
				return;
			}

			page.removeAllListeners();
			if (!page.isClosed) {
				await page.close();
			}

			if (!result.isSkipped) {
				const checkedKeyword = keywordCheck(result.html, excludeKeywords);

				if (checkedKeyword) {
					result = {
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

			if (result.isSkipped) {
				if (result.matched.type === 'path') {
					return;
				}
				void this.emit('ignoreAndSkip', {
					pid: process.pid,
					url: this.#url,
					reason: {
						matchedText: result.matched.text,
						excludeKeywords,
					},
				});
				void this.emit('changePhase', {
					pid: process.pid,
					name: 'ignoreAndSkip',
					url: this.#url,
					isExternal,
					message: `Matched: "${result.matched.text}"`,
				});
				return;
			}
		}

		void this.emit('scrapeEnd', {
			pid: process.pid,
			url: this.#url,
			timestamp: Date.now(),
			result,
		});

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'scrapeEnd',
			url: this.#url,
			isExternal,
			message: '',
		});

		return result;
	}

	@retry()
	async #bootBrowser(
		isExternal: boolean,
		executablePath: string | null,
		headless: boolean | 'shell',
	) {
		if (!this.#browser) {
			void this.emit('changePhase', {
				pid: process.pid,
				name: 'launchBrowser',
				url: this.#url,
				isExternal,
				message: executablePath || '(executablePath is default)',
			});

			const browser = await puppeteer
				.launch({
					headless,
					timeout: LAUNCH_BROWSER_TIMEOUT,
					executablePath: executablePath ?? undefined,
					args: [
						// TODO: Optional lang
						'--lang=ja',
						'--no-zygote',
						'--ignore-certificate-errors',
					],
				})
				.catch((error) => {
					if (error instanceof Error) {
						return error;
					}
					throw error;
				});

			if (browser instanceof Error) {
				void this.emit('error', {
					pid: process.pid,
					url: this.#url!,
					shutdown: false,
					error: browser,
				});
				throw browser;
			}

			this.#browser = browser;
		} else if (!this.#browser.isConnected()) {
			await this.#browser.close();
		}

		return this.#browser;
	}

	@retry()
	async #createPage(
		isExternal: boolean,
		executablePath: string | null,
		headless: boolean | 'shell',
	) {
		const browser = await this.#bootBrowser(isExternal, executablePath, headless);

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'newPage',
			url: this.#url,
			isExternal,
			message: '',
		});

		const page = await browser.newPage();
		page.setDefaultNavigationTimeout(0);
		await page.setUserAgent(
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
		);
		await page.setExtraHTTPHeaders({
			// TODO: Optional lang
			'Accept-Language': 'ja-JP',
		});

		return page;
	}

	@retry({
		timeout: 1 * 60 * 1000, // 1sec,
		// retries: 1,
	})
	async #fetchData(
		page: Page,
		url: ExURL,
		isExternal: boolean,
		isGettingImages: boolean,
		options?: ParseURLOptions,
	): Promise<PageData | SkippedPageData> {
		const networkLogs: Record<string, NetworkLog> = {};

		page.on('dialog', async (dialog) => {
			log(`Appear ${dialog.type()} dialog: ${dialog.message()}`);
			try {
				await dialog.accept();
			} catch (error) {
				log(`Error: ${error}`);
			}
			log(`Accept ${dialog.type()} dialog`);
		});

		if (!isExternal) {
			page.on('request', (request) => {
				const url = parseUrl(request.url(), options)!;
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
			});

			const uniqueRes = new Set<string>();
			page.on('response', (response) => {
				const resURL = parseUrl(response.url(), options)!;

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
				void this.emit('resourceResponse', {
					pid: process.pid,
					url,
					log,
					resource: referredLink,
				});
			});
		}

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'openPage',
			url: this.#url,
			isExternal,
			message: '',
		});

		if (url.username && url.password) {
			// await page.authenticate({ username: url.username, password: url.password });
			await page.setExtraHTTPHeaders({
				Authorization: `Basic ${Buffer.from(`${url.username}:${url.password}`).toString('base64')}`,
			});
		}

		const res = await page.goto(url.withoutHashAndAuth);

		if (!res) {
			throw new Error('The method Page.goto returned null');
		}

		const destUrl = parseUrl(page.url(), options)!;
		const redirectPaths = res
			.request()
			.redirectChain()
			.map((req) => req.url());
		if (destUrl.withoutHash !== url.withoutHash) {
			redirectPaths.push(destUrl.withoutHash);
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
				redirectPaths,
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
			url: this.#url,
			isExternal,
			message: '',
		});

		await page
			.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 })
			.catch(() => {});

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'getHTML',
			url: this.#url,
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
				redirectPaths,
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
			name: 'waitNetworkIdleZero',
			url: this.#url,
			isExternal,
			message: '',
		});

		await page
			.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 })
			.catch(() => {});

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'getAnchors',
			url: this.#url,
			isExternal,
			message: '',
		});
		const anchorList = await getAnchorList(page, options);

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'getMeta',
			url: this.#url,
			isExternal,
			message: '',
		});
		const meta = await getMeta(page);

		const imageList = isGettingImages ? await this.#fetchImages(page, isExternal) : [];

		return {
			url,
			isTarget: true,
			isExternal,
			redirectPaths,
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

	@retry()
	async #fetchHead(url: ExURL, isExternal: boolean) {
		return await fetchDestination(url, isExternal);
	}

	@retry({
		timeout: 5 * 60 * 1000, // 5sec
		fallback: [],
	})
	async #fetchImages(page: Page, isExternal: boolean): Promise<ImageElement[]> {
		const imageList: ImageElement[] = [];
		void this.emit('changePhase', {
			pid: process.pid,
			name: 'setViewport',
			url: this.#url,
			isExternal,
			message: '1280x800',
		});
		await page.setViewport({ width: 1280, height: 800 });

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'scrollToBottom',
			url: this.#url,
			isExternal,
			message: '1280x800',
		});
		await autoScroll(page, 800);

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'getImages',
			url: this.#url,
			isExternal,
			message: '1280x800',
		});
		const imageListDesktop = await getImageList(page, 1280);

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'setViewport',
			url: this.#url,
			isExternal,
			message: '320x568',
		});
		await page.setViewport({
			width: 320,
			height: 568,
			deviceScaleFactor: 2,
			isMobile: true,
			hasTouch: true,
		});

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'scrollToBottom',
			url: this.#url,
			isExternal,
			message: '320x568',
		});
		await autoScroll(page, 568);

		void this.emit('changePhase', {
			pid: process.pid,
			name: 'getImages',
			url: this.#url,
			isExternal,
			message: '320x568',
		});
		const imageListMobile = await getImageList(page, 320);

		imageList.push(...imageListDesktop, ...imageListMobile);
		return imageList;
	}
}

async function autoScroll(page: Page, height: number) {
	await page.evaluate(async (height: number) => {
		/* global window */
		await new Promise<void>((resolve) => {
			let totalHeight = 0;
			const distance = height;
			const timer = setInterval(() => {
				const scrollHeight = document.body.scrollHeight;
				window.scrollBy(0, distance);
				totalHeight += distance;

				if (totalHeight >= scrollHeight || totalHeight >= 50_000) {
					clearInterval(timer);
					resolve();
				}
			}, 100);
		});
	}, height);
}
