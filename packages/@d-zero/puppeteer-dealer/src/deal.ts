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
export function deal<T, R = void>(
	list: readonly URLInfo[],
	header: DealHeader,
	createProcess: () => (needAuth: boolean) => ChildProcessManager<T, R>,
	options?: Omit<DealOptions, 'header'> & {
		each?: (
			result: R,
			push: (...items: URLInfo[]) => Promise<void>,
		) => void | Promise<void>;
	},
) {
	const needAuth = list.some(({ url }) => {
		const urlObj = new URL(url);
		return !!(urlObj.username && urlObj.password);
	});

	return coreDeal(
		list,
		({ id, url }, update, index, setLineHeader, push) => {
			const fileId = id || index.toString().padStart(3, '0');
			const lineHeader = `%braille% ${c.bgWhite(` ${fileId} `)} ${c.gray(url.toString())}: `;
			setLineHeader(lineHeader);

			return async () => {
				update(`Using ${needAuth ? 'auth' : 'no auth'}`);
				const processManager = createProcess()(needAuth);
				update(`Booting ChildProcess%dots%`);
				await processManager.ready();
				processManager.log((log) => update(log));
				const result = await processManager.each(fileId, url.toString(), index);
				if (options?.each) {
					await options.each(result, push);
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
