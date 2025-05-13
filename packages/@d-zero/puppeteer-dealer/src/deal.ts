import type { MainProcess } from './create-main-process.js';
import type { URLInfo } from './types.js';
import type { DealHeader } from '@d-zero/dealer';

import { deal as coreDeal } from '@d-zero/dealer';
import c from 'ansi-colors';

/**
 *
 * @param list
 * @param header
 * @param createProcess
 * @param each
 */
export function deal<T extends Record<string, unknown>, R = void>(
	list: readonly URLInfo[],
	header: DealHeader,
	createProcess: () => MainProcess<T, R>,
	each?: (result: R) => void | Promise<void>,
) {
	return coreDeal(
		list,
		({ id, url }, update, index) => {
			const fileId = id || index.toString().padStart(3, '0');
			const lineHeader = `%braille% ${c.bgWhite(` ${fileId} `)} ${c.gray(url.toString())}: `;
			const mainProcess = createProcess();

			return async () => {
				await mainProcess.ready();
				mainProcess.log((log) => {
					update(`${lineHeader}${log}`);
				});
				const result = await mainProcess.each(fileId, url.toString(), index);
				if (each) {
					await each(result);
				}
				await mainProcess.close();
			};
		},
		{
			header,
		},
	);
}
