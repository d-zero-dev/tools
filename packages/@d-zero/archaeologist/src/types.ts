import type { Screenshot } from '@d-zero/puppeteer-screenshot';

export type PageData = {
	url: string;
	serializedHtml: string;
	screenshots: Record<string, Screenshot>;
};

export type URLPair = readonly [urlA: string, urlB: string];

export type Result = {
	target: [urlA: string, urlB: string];
	screenshots: Record<
		string,
		{
			matches: number;
			file: string;
		}
	>;
	html: {
		matches: number;
		diff: string | null;
		file: string;
	};
};
