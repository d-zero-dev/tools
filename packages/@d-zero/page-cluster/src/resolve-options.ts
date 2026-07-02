import type { ResolvedOptions, TokenizeOptions } from './types.js';

/**
 * Applies defaults to {@link TokenizeOptions}.
 * @param options
 */
export function resolveOptions(options?: TokenizeOptions): ResolvedOptions {
	return {
		filterNoiseClasses: options?.filterNoiseClasses ?? true,
		includeComments: options?.includeComments ?? false,
	};
}
