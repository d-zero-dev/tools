import type { RemoteInspectorOptions } from './types.js';

/**
 *
 * @param options
 */
export function validateRemoteInspectorArgs(options: RemoteInspectorOptions): void {
	if (!options.host) {
		throw new Error('--host or RELEASE_HOST is required');
	}
	if (!options.user) {
		throw new Error('--user or RELEASE_USER is required');
	}
	if (!options.keyPath && !options.password) {
		throw new Error(
			'Either --key/RELEASE_KEY or --password/RELEASE_PASSWORD is required',
		);
	}
	if (options.keyPath && options.password) {
		throw new Error(
			'Cannot use both --key and --password authentication at the same time',
		);
	}
	if (!options.remoteDir) {
		throw new Error('--remote-dir or RELEASE_DIR is required');
	}
}
