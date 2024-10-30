import type { AxeResults, Locale, Spec } from 'axe-core';
import type {
	Browser,
	EvaluateFunc,
	EventsWithWildcard,
	GoToOptions,
	Handler,
	PageEvents,
	PDFOptions,
	Page as PPTRPage,
	PuppeteerLaunchOptions,
	ScreenshotOptions,
	Viewport,
	WaitForOptions,
} from 'puppeteer';

import AxePuppeteer from '@axe-core/puppeteer';
import { delay } from '@d-zero/shared/delay';
import puppeteer from 'puppeteer';

import { ChildProcessHostedPuppeteerPage } from './puppeteer-page-main-process.js';

export type PageOptions = {
	runChildProcess?: boolean;
} & PuppeteerLaunchOptions;

type PageContext =
	| {
			type: 'main';
			browser: Browser;
			page: PPTRPage;
	  }
	| {
			type: 'child';
			page: ChildProcessHostedPuppeteerPage;
			pid: number;
	  };

export class Page {
	#context: PageContext;

	get pid() {
		return this.#context.type === 'child' ? this.#context.pid : null;
	}

	// eslint-disable-next-line no-restricted-syntax
	private constructor(context: PageContext) {
		this.#context = context;
	}

	async axe(
		config?: Spec & {
			lang?: string;
			log?: (log: string) => void;
		},
	): Promise<AxeResults> {
		config = {
			...config,
		};

		if (config?.lang) {
			const mod = await import(`axe-core/locales/${config.lang}.json`, {
				with: { type: 'json' },
			});

			const locale: Locale = mod.default;

			config.locale = locale;
		}

		config?.log?.(`Analyze%dots%`);
		let axeResults: AxeResults;

		if (this.#context.type === 'main') {
			axeResults = await new AxePuppeteer(this.#context.page).configure(config).analyze();
		} else {
			axeResults = await this.#context.page.axe(config);
		}

		config?.log?.(
			`Found ${axeResults.violations.length} violations, ${axeResults.incomplete.length} incomplete issues`,
		);

		await delay(600);

		return axeResults;
	}

	close() {
		return this.#context.page.close();
	}

	content() {
		return this.#context.page.content();
	}

	async elementScreenshot(
		selector: string,
		options?: ScreenshotOptions,
	): Promise<Uint8Array | null>;
	async elementScreenshot(
		selector: string,
		options?: ScreenshotOptions & { encoding: 'base64' },
	): Promise<string | null>;
	async elementScreenshot(
		selector: string,
		options?: ScreenshotOptions & { encoding?: 'base64' },
	): Promise<string | Uint8Array | null> {
		if (this.#context.type === 'main') {
			const fileElement = await this.#context.page.waitForSelector(selector);
			return (await fileElement?.screenshot(options)) ?? null;
		}
		return this.#context.page.elementScreenshot(selector, options);
	}

	evaluate<
		Params extends unknown[],
		Func extends EvaluateFunc<Params> = EvaluateFunc<Params>,
	>(pageFunction: Func | string, ...args: Params): Promise<Awaited<ReturnType<Func>>> {
		return this.#context.page.evaluate(pageFunction, ...args);
	}

	goto(url: string, options?: GoToOptions) {
		return this.#context.page.goto(url, options);
	}

	isClosed() {
		return this.#context.page.isClosed();
	}

	on<Key extends keyof PageEvents>(
		type: Key,
		handler: Handler<EventsWithWildcard<PageEvents>[Key]>,
	): this {
		this.#context.page.on(type, handler);
		return this;
	}

	pdf(options: PDFOptions) {
		return this.#context.page.pdf(options);
	}

	reload(options?: WaitForOptions) {
		return this.#context.page.reload(options);
	}

	screenshot(options: ScreenshotOptions) {
		return this.#context.page.screenshot(options);
	}

	setDefaultNavigationTimeout(timeout: number) {
		return this.#context.page.setDefaultNavigationTimeout(timeout);
	}

	setExtraHTTPHeaders(headers: Record<string, string>) {
		return this.#context.page.setExtraHTTPHeaders(headers);
	}

	setViewport(viewport: Viewport) {
		return this.#context.page.setViewport(viewport);
	}

	title() {
		return this.#context.page.title();
	}

	async url() {
		return await this.#context.page.url();
	}

	static async create(options?: PageOptions): Promise<Page> {
		const runChildProcess = options?.runChildProcess ?? true; // default to true

		if (runChildProcess) {
			const page = new ChildProcessHostedPuppeteerPage(options);
			await page.initialized();
			const pid = page.pid;

			return new Page({
				type: 'child',
				page,
				pid,
			});
		}

		const browser = await puppeteer.launch(options);
		const page = await browser?.newPage();

		return new Page({
			type: 'main',
			browser,
			page,
		});
	}
}
