import type { Page } from 'puppeteer';

export type Listener<P> = (phase: keyof P, data: P[keyof P]) => void;

export type Sizes = Record<string, Size>;

export type Size = { width: number; resolution?: number };

export type PageHook = (
	page: Page,
	size: Size & {
		name: string;
		log: (message: string) => void;
	},
) => Promise<void>;

export type Phase = {
	setViewport: { name: string; width: number; resolution?: number };
	hook: { name: string; message: string };
	load: { name: string; type: 'open' | 'reaload' };
	scroll: { name: string };
};
