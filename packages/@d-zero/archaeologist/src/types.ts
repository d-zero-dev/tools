export type { PageHook } from '@d-zero/puppeteer-screenshot';

import type { PageHook, Screenshot } from '@d-zero/puppeteer-screenshot';

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
	dom: DOMResult | null;
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ArchaeologistOptions extends AnalyzeOptions {}

export interface AnalyzeOptions extends GeneralOptions {
	readonly types?: readonly string[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FreezeOptions extends GeneralOptions {}

interface GeneralOptions {
	readonly hooks: readonly PageHook[];
	readonly limit?: number;
	readonly debug?: boolean;
}
