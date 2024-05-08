import type { PageHook } from '@d-zero/puppeteer-screenshot';

import path from 'node:path';

export async function readHooks(
	hooks: readonly string[],
	listfile: string,
): Promise<PageHook[]> {
	const listfileDir = path.dirname(listfile);

	const pageHooks = await Promise.all(
		hooks.map(async (hook) => {
			const hookAbsPath = path.isAbsolute(hook) ? hook : path.resolve(listfileDir, hook);

			const { default: mod } = await import(hookAbsPath).catch((error: unknown) => {
				if (
					error instanceof Error &&
					'code' in error &&
					error.code === 'ERR_MODULE_NOT_FOUND'
				) {
					throw new Error(`Hook: ${hook} not found`, { cause: error });
				}
				throw error;
			});
			if (typeof mod !== 'function') {
				throw new TypeError(`Hook ${hook} is not a function`);
			}
			return mod as PageHook;
		}),
	);

	return pageHooks;
}
