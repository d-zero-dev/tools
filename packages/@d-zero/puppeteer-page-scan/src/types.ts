import type { Page } from 'puppeteer';

export type Sizes = Record<string, Size>;

export type Size = { width: number; resolution?: number };

export type PageHook = (
	page: Page,
	size: Size & {
		name: string;
		log: (message: string) => void;
	},
) => Promise<void>;

/**
 * 子プロセスにフックをIPCで渡すための「ロード元の記述」。
 * 親プロセスではこの形のまま保持し、子プロセスで `readPageHooks(paths, baseDir)`
 * を呼んで関数化する。Node IPC は関数を `null` 化するため、関数配列を直接渡せない。
 */
export type PageHookSource = {
	readonly paths: readonly string[];
	readonly baseDir: string;
};

export type PageScanPhase = {
	setViewport: { name: string; width: number; resolution?: number };
	hook: { name: string; message: string };
	load: { name: string; type: 'open' | 'reload'; timeout: number; id: string };
	scroll: { name: string; scrollY: number; scrollHeight: number; message: string };
};
