import type { ChildProcessManager } from './create-main-process.js';
import type { URLInfo } from './types.js';
import type { DealHeader, DealOptions } from '@d-zero/dealer';

import { deal as coreDeal } from '@d-zero/dealer';
import c from 'ansi-colors';

/**
 *
 * @param list
 * @param header
 * @param createProcess
 * @param options
 */
export function deal<T extends Record<string, unknown>, R = void>(
	list: readonly URLInfo[],
	header: DealHeader,
	createProcess: () => ChildProcessManager<T, R>,
	options?: Omit<DealOptions, 'header'> & {
		each?: (result: R) => void | Promise<void>;
	},
) {
	return coreDeal(
		list,
		({ id, url }, update, index) => {
			const fileId = id || index.toString().padStart(3, '0');
			const lineHeader = `%braille% ${c.bgWhite(` ${fileId} `)} ${c.gray(url.toString())}: `;

			return async () => {
				const processManager = createProcess();
				update(`${lineHeader}Booting ChildProcess%dots%`);
				await processManager.ready();
				processManager.log((log) => {
					update(`${lineHeader}${log}`);
				});
				const result = await processManager.each(fileId, url.toString(), index);
				if (options?.each) {
					await options.each(result);
				}
				await processManager.close();
			};
		},
		{
			...options,
			header,
		},
	);
}
