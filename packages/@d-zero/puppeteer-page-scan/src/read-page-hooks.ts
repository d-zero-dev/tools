import type { PageHook } from './types.js';

import path from 'node:path';

export async function readPageHooks(
	hooks: readonly string[],
	baseDir: string,
): Promise<PageHook[]> {
	const pageHooks = await Promise.all(
		hooks.map(async (hook) => {
			const hookAbsPath = path.isAbsolute(hook) ? hook : path.resolve(baseDir, hook);

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
