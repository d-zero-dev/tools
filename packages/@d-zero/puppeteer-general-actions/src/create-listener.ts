import type { Listener, Loggers } from './types.js';

import c from 'ansi-colors';

export function createListener<P extends Record<string, { name: string }>>(
	listener: Loggers<P>,
) {
	return (log: (log: string) => void): Listener<P> => {
		return (phase, data) => {
			const sizeLabel = c.bgMagenta(` ${data.name} `);
			const listen = listener((text) => log(`${sizeLabel} ${text}`));
			listen[phase]?.(data);
		};
	};
}
