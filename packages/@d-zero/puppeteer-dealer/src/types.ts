import type { DealOptions } from '@d-zero/dealer';
import type { Page } from 'puppeteer';

export type PuppeteerDealerOptions = {
	readonly locale?: string;
} & DealOptions;

export type PuppeteerDealHandler = {
	beforeOpenPage?: (
		id: string,
		url: string,
		log: Logger,
		index: number,
	) => Promise<boolean>;
	deal: (
		page: Page,
		id: string,
		url: string,
		log: Logger,
		index: number,
	) => Promise<void>;
};

export type URLInfo = {
	readonly id: string | null;
	readonly url: string | URL;
};

export type Logger = (log: string) => void;

export type CommonParams = {
	readonly needAuth: boolean;
};

export type ChildProcessMethods<R> = {
	eachPage: (params: EachPageParams, logger: Logger) => Promise<R>;
};

type EachPageParams = {
	readonly page: Page;
	readonly id: string;
	readonly url: string;
	readonly index: number;
};

export type ChildProcessCommonParams = {
	readonly id: string;
	readonly url: string;
	readonly logger: Logger;
};

export type ChildProcessHandler<P extends CommonParams, R> = (
	params: P,
) => Promise<ChildProcessMethods<R>> | ChildProcessMethods<R>;

export type ChildProcessCommands<P extends CommonParams, R> = {
	init: () => Promise<P>;
	each: (id: string, url: string, index: number) => Promise<R>;
	log: Logger;
};
