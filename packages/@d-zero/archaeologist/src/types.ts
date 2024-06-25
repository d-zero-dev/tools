export type { PageHook } from '@d-zero/puppeteer-screenshot';

import type { Screenshot } from '@d-zero/puppeteer-screenshot';

export type PageData = {
	url: string;
	screenshots: Record<string, Screenshot & { domTree: string }>;
};

export type URLPair = readonly [urlA: string, urlB: string];

export type Result = {
	target: [urlA: string, urlB: string];
	screenshots: Record<string, MediaResult>;
};

export type MediaResult = {
	image: ImageResult | null;
	dom: DOMResult;
};

export type ImageResult = {
	matches: number;
	file: string;
};

export type DOMResult = {
	matches: number;
	diff: string | null;
	file: string;
};
