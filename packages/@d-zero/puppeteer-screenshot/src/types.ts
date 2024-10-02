import type { Page } from 'puppeteer';

export type Sizes = Record<string, Size>;

export type Size = { width: number; resolution?: number };

export type Screenshot = {
	id: string;
	filePath: string | null;
	url: string;
	binary: Uint8Array | null;
	dom: string;
} & Size;

export type Phase = {
	setViewport: { name: string; width: number; resolution?: number };
	hook: { name: string; message: string };
	load: { name: string; type: 'open' | 'reaload' };
	scroll: { name: string };
	screenshotStart: { name: string };
	screenshotEnd: { name: string; binary: Uint8Array };
	screenshotSaving: { name: string; path: string };
	screenshotError: { name: string; error: Error };
	getDOMStart: { name: string };
	getDOMEnd: { name: string; dom: string };
};

export type Listener = (phase: keyof Phase, data: Phase[keyof Phase]) => void;

export type PageHook = (
	page: Page,
	size: Size & {
		name: string;
		log: (message: string) => void;
	},
) => Promise<void>;
