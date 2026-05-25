import type { ChildProcessParams } from './print-child-process.js';
import type { PrintType } from './types.js';
import type { PageHook, Sizes } from '@d-zero/puppeteer-page-scan';
import type { DelayOptions } from '@d-zero/shared/delay';
import type { LaunchOptions } from 'puppeteer';

import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { createProcess, deal } from '@d-zero/puppeteer-dealer';
import c from 'ansi-colors';

export interface PrintOptions {
	readonly type?: PrintType;
	readonly limit?: number;
	readonly debug?: boolean;
	readonly verbose?: boolean;
	readonly hooks?: readonly PageHook[];
	readonly devices?: Sizes;
	readonly timeout?: number;
	readonly interval?: number | DelayOptions;
	readonly openDisclosures?: boolean;
	/**
	 * ページ内スクロールのステップ間隔（ms）。
	 * 固定値またはランダム範囲（`{ random: ... }`）を指定可能。
	 * 省略時は `@d-zero/puppeteer-scroll` のデフォルト（ランダム 200-500ms）。
	 */
	readonly scrollInterval?: number | DelayOptions;
	/**
	 * 1スクロールステップで進むピクセル数。
	 * 固定値またはランダム範囲を指定可能。
	 * 省略時は `@d-zero/puppeteer-scroll` のデフォルト（ビューポート高さの 50-100% のランダム）。
	 */
	readonly scrollDistance?: number | DelayOptions;
}

/**
 *
 * @param urlList
 * @param options
 */
export async function print(
	urlList: readonly (
		| string
		| {
				id: string | null;
				url: string;
		  }
	)[],
	options?: PrintOptions & LaunchOptions,
) {
	const dir = path.resolve(process.cwd(), '.print');
	await mkdir(dir, { recursive: true }).catch(() => {});

	const type = options?.type ?? 'png';

	await deal(
		urlList.map((url) => {
			if (typeof url === 'string') {
				return { id: null, url };
			}
			return url;
		}),
		(_, done, total) => {
			return `${c.bold.magenta('🎨 Print pages')} ${c.bgBlueBright(` ${type} `)} ${done}/${total}`;
		},
		() => {
			return createProcess<ChildProcessParams>(
				path.resolve(import.meta.dirname, 'print-child-process.js'),
				{
					dir,
					type,
					hooks: options?.hooks,
					devices: options?.devices,
					timeout: options?.timeout,
					openDisclosures: options?.openDisclosures,
					scrollInterval: options?.scrollInterval,
					scrollDistance: options?.scrollDistance,
				},
				{
					...options,
					interval: options?.interval,
				},
			);
		},
		{
			limit: options?.limit,
			debug: options?.debug,
			verbose: options?.verbose,
			interval: options?.interval,
		},
	);
}
