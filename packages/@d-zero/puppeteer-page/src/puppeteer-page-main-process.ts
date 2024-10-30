import type { ExtendedPageInterface } from './types.js';
import type { AxeResults, Spec } from 'axe-core';
import type {
	Browser,
	BrowserContext,
	CDPSession,
	Cookie,
	CookieParam,
	Coverage,
	Credentials,
	DeleteCookiesRequest,
	Device,
	DeviceRequestPrompt,
	EvaluateFunc,
	EvaluateFuncWith,
	EventsWithWildcard,
	FileChooser,
	Frame,
	GoToOptions,
	HandleFor,
	HTTPResponse,
	JSHandle,
	Keyboard,
	MediaFeature,
	Metrics,
	Mouse,
	NetworkConditions,
	NewDocumentScriptEvaluation,
	NodeFor,
	PageEvents,
	PDFOptions,
	Protocol,
	PuppeteerLaunchOptions,
	ScreenshotOptions,
	Target,
	Touchscreen,
	Tracing,
	Viewport,
	WaitForOptions,
	WaitTimeoutOptions,
	WebWorker,
} from 'puppeteer';
import type { ParseSelector } from 'typed-query-selector/parser.js';

import path from 'node:path';

import { ProcTalk } from '@d-zero/proc-talk';
import { raceWithTimeout } from '@d-zero/shared/race-with-timeout';
import { Page } from 'puppeteer';

import { log } from './debug.js';

const SUB_PROCESS_PATH = path.resolve(
	import.meta.dirname,
	'puppeteer-page-child-process.js',
);

@UnsafeDefineMethods(['screenshot', 'on'])
export class ChildProcessHostedPuppeteerPage extends Page {
	readonly process: ProcTalk<ExtendedPageInterface, PuppeteerLaunchOptions>;

	override get mouse(): Mouse {
		throw new Error('Not implemented');
	}

	override get tracing(): Tracing {
		throw new Error('Not implemented');
	}

	override get coverage(): Coverage {
		throw new Error('Not implemented');
	}

	override get keyboard(): Keyboard {
		throw new Error('Not implemented');
	}

	override get touchscreen(): Touchscreen {
		throw new Error('Not implemented');
	}

	get pid() {
		return this.process.pid;
	}

	constructor(options?: PuppeteerLaunchOptions) {
		super();

		this.process = new ProcTalk({
			type: 'main',
			subModulePath: SUB_PROCESS_PATH,
			options,
		});
	}

	axe(config: Spec): Promise<AxeResults> {
		return this.process.call('axe', config);
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
		return this.process.call('elementScreenshot', selector, options);
	}

	async initialized() {
		return await this.process.initialized();
	}

	// @ts-ignore
	override url(): Promise<string> {
		return this.process.call('url');
	}

	override waitForDevicePrompt(
		options?: WaitTimeoutOptions,
	): Promise<DeviceRequestPrompt> {
		void options;
		throw new Error('Not implemented');
	}

	override async setViewport(viewport: Viewport | null): Promise<void> {
		return await this.process.call('setViewport', viewport);
	}

	override viewport(): Viewport | null {
		throw new Error('Not implemented');
	}

	override pdf(options?: PDFOptions): Promise<Uint8Array> {
		return this.process.call('pdf', options);
	}

	override async title(): Promise<string> {
		return await this.process.call('title');
	}

	override async close(options?: { runBeforeUnload?: boolean }): Promise<void> {
		const TIME_OUT = 30_000;

		log('Closing page(%d)', this.process.pid);
		const { timeout } = await raceWithTimeout(async () => {
			await this.process.call('close', options);
		}, TIME_OUT);

		if (timeout) {
			log('Timeout(%dms) closing page', TIME_OUT);
		}

		const closed = this.process.close();

		if (!closed) {
			log('Need force killing process(%d)', this.process.pid);
		}

		log('Closed page(%d)', this.process.pid);
	}

	// @ts-ignore
	override isClosed(): Promise<boolean> {
		return this.process.call('isClosed');
	}

	override emulate(device: Device): Promise<void> {
		void device;
		throw new Error('Not implemented');
	}

	override emit<Key extends keyof PageEvents>(
		type: Key,
		event: EventsWithWildcard<PageEvents>[Key],
	): boolean {
		void type;
		void event;
		throw new Error('Not implemented');
	}

	override emulateCPUThrottling(factor: number | null): Promise<void> {
		void factor;
		throw new Error('Not implemented');
	}

	override emulateIdleState(overrides?: {
		isUserActive: boolean;
		isScreenUnlocked: boolean;
	}): Promise<void> {
		void overrides;
		throw new Error('Not implemented');
	}

	override emulateMediaFeatures(features?: MediaFeature[]): Promise<void> {
		void features;
		throw new Error('Not implemented');
	}

	override emulateMediaType(type?: string): Promise<void> {
		void type;
		throw new Error('Not implemented');
	}

	override emulateTimezone(timezoneId?: string): Promise<void> {
		void timezoneId;
		throw new Error('Not implemented');
	}

	override emulateVisionDeficiency(
		type?: Protocol.Emulation.SetEmulatedVisionDeficiencyRequest['type'],
	): Promise<void> {
		void type;
		throw new Error('Not implemented');
	}

	override removeScriptToEvaluateOnNewDocument(identifier: string): Promise<void> {
		void identifier;
		throw new Error('Not implemented');
	}

	override evaluate<
		Params extends unknown[],
		Func extends EvaluateFunc<Params> = EvaluateFunc<Params>,
	>(pageFunction: Func | string, ...args: Params): Promise<Awaited<ReturnType<Func>>> {
		return this.process.call(
			'evaluate',
			// @ts-ignore
			pageFunction,
			...args,
		);
	}

	override evaluateHandle<
		Params extends unknown[],
		Func extends EvaluateFunc<Params> = EvaluateFunc<Params>,
	>(
		pageFunction: Func | string,
		...args: Params
	): Promise<HandleFor<Awaited<ReturnType<Func>>>> {
		void pageFunction;
		void args;
		throw new Error('Not implemented');
	}

	override evaluateOnNewDocument<
		Params extends unknown[],
		Func extends (...args: Params) => unknown = (...args: Params) => unknown,
	>(pageFunction: Func | string, ...args: Params): Promise<NewDocumentScriptEvaluation> {
		void pageFunction;
		void args;
		throw new Error('Not implemented');
	}

	override $eval<
		Selector extends string,
		Params extends unknown[],
		Func extends EvaluateFuncWith<NodeFor<Selector>, Params> = EvaluateFuncWith<
			ParseSelector<Selector, Element>,
			Params
		>,
	>(
		selector: Selector,
		pageFunction: Func | string,
		...args: Params
	): Promise<Awaited<ReturnType<Func>>> {
		void selector;
		void pageFunction;
		void args;
		throw new Error('Not implemented');
	}

	override $$eval<
		Selector extends string,
		Params extends unknown[],
		Func extends EvaluateFuncWith<Array<NodeFor<Selector>>, Params> = EvaluateFuncWith<
			ParseSelector<Selector, Element>[],
			Params
		>,
	>(
		selector: Selector,
		pageFunction: Func | string,
		...args: Params
	): Promise<Awaited<ReturnType<Func>>> {
		void selector;
		void pageFunction;
		void args;
		throw new Error('Not implemented');
	}

	override setCacheEnabled(enabled?: boolean): Promise<void> {
		void enabled;
		throw new Error('Not implemented');
	}

	override setBypassCSP(enabled: boolean): Promise<void> {
		void enabled;
		throw new Error('Not implemented');
	}

	override setJavaScriptEnabled(enabled: boolean): Promise<void> {
		void enabled;
		throw new Error('Not implemented');
	}

	override goBack(options?: WaitForOptions): Promise<HTTPResponse | null> {
		void options;
		throw new Error('Not implemented');
	}

	override goForward(options?: WaitForOptions): Promise<HTTPResponse | null> {
		void options;
		throw new Error('Not implemented');
	}

	override async goto(url: string, options?: GoToOptions): Promise<HTTPResponse | null> {
		return await this.process.call('goto', url, options);
	}

	override async reload(options?: WaitForOptions): Promise<HTTPResponse | null> {
		return await this.process.call('reload', options);
	}

	override metrics(): Promise<Metrics> {
		throw new Error('Not implemented');
	}

	override setUserAgent(
		userAgent: string,
		userAgentMetadata?: Protocol.Emulation.UserAgentMetadata,
	): Promise<void> {
		void userAgent;
		void userAgentMetadata;
		throw new Error('Not implemented');
	}

	override setExtraHTTPHeaders(headers: Record<string, string>): Promise<void> {
		return this.process.call('setExtraHTTPHeaders', headers);
	}

	override authenticate(credentials: Credentials | null): Promise<void> {
		void credentials;
		throw new Error('Not implemented');
	}

	override removeExposedFunction(name: string): Promise<void> {
		void name;
		throw new Error('Not implemented');
	}

	override exposeFunction(
		name: string,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		pptrFunction: Function | { default: Function }, // cspell: disable-line
	): Promise<void> {
		void name;
		void pptrFunction; // cspell: disable-line
		throw new Error('Not implemented');
	}

	override setCookie(...cookies: CookieParam[]): Promise<void> {
		void cookies;
		throw new Error('Not implemented');
	}

	override deleteCookie(...cookies: DeleteCookiesRequest[]): Promise<void> {
		void cookies;
		throw new Error('Not implemented');
	}

	override cookies(...urls: string[]): Promise<Cookie[]> {
		void urls;
		throw new Error('Not implemented');
	}

	override queryObjects<Prototype>(
		prototypeHandle: JSHandle<Prototype>,
	): Promise<JSHandle<Prototype[]>> {
		void prototypeHandle;
		throw new Error('Not implemented');
	}

	override setDefaultTimeout(timeout: number): void {
		void timeout;
		throw new Error('Not implemented');
	}

	override getDefaultTimeout(): number {
		throw new Error('Not implemented');
	}

	override setDefaultNavigationTimeout(timeout: number): Promise<void> {
		return this.process.call('setDefaultNavigationTimeout', timeout);
	}

	override setOfflineMode(enabled: boolean): Promise<void> {
		void enabled;
		throw new Error('Not implemented');
	}

	override emulateNetworkConditions(
		networkConditions: NetworkConditions | null,
	): Promise<void> {
		void networkConditions;
		throw new Error('Not implemented');
	}

	override setDragInterception(enabled: boolean): Promise<void> {
		void enabled;
		throw new Error('Not implemented');
	}

	override setBypassServiceWorker(bypass: boolean): Promise<void> {
		void bypass;
		throw new Error('Not implemented');
	}

	override setRequestInterception(value: boolean): Promise<void> {
		void value;
		throw new Error('Not implemented');
	}

	override workers(): WebWorker[] {
		throw new Error('Not implemented');
	}

	override frames(): Frame[] {
		throw new Error('Not implemented');
	}

	override createPDFStream(options?: PDFOptions): Promise<ReadableStream<Uint8Array>> {
		void options;
		throw new Error('Not implemented');
	}

	override createCDPSession(): Promise<CDPSession> {
		throw new Error('Not implemented');
	}

	override mainFrame(): Frame {
		throw new Error(
			'Not implemented. `Frame` is returned empty object due to it cannot be serialized',
		);
		// return this.process.callSync('mainFrame');
	}

	override browser(): Browser {
		throw new Error('Not implemented');
	}

	override bringToFront(): Promise<void> {
		throw new Error('Not implemented');
	}

	override browserContext(): BrowserContext {
		throw new Error('Not implemented');
	}

	override content(): Promise<string> {
		return this.process.call('content');
	}

	override target(): Target {
		throw new Error('Not implemented');
	}

	override setGeolocation(): Promise<void> {
		throw new Error('Not implemented');
	}

	override waitForFileChooser(): Promise<FileChooser> {
		throw new Error('Not implemented');
	}

	override isJavaScriptEnabled(): boolean {
		throw new Error('Not implemented');
	}

	override isDragInterceptionEnabled(): boolean {
		throw new Error('Not implemented');
	}

	override isServiceWorkerBypassed(): boolean {
		throw new Error('Not implemented');
	}
}

function UnsafeDefineMethods<T>(methods: string[]) {
	return (Constructor: T) => {
		const addMethod = (name: string) => {
			Object.defineProperty(
				// @ts-ignore
				Constructor.prototype,
				name,
				{
					value: async function (...args: unknown[]) {
						if (this.process) {
							return await this.process.call(name, ...args);
						}
						// @ts-ignore
						return Page.prototype[name]?.call?.(this, ...args);
					},
					writable: false,
					enumerable: false,
					configurable: false,
				},
			);
		};

		// eslint-disable-next-line unicorn/no-array-for-each
		methods.forEach(addMethod);
	};
}
