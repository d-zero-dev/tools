import type { DealOptions } from '@d-zero/dealer';
import type { Page } from '@d-zero/puppeteer-page';

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
