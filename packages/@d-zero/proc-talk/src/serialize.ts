import type { log } from 'debug';

export function serialize(data: unknown[], logger: typeof log): unknown[] {
	// Remove empty items from the end
	if (data.length > 0) {
		const reversedArgs = data.toReversed();
		const filteredArgs: unknown[] = [];
		// eslint-disable-next-line no-constant-condition
		while (reversedArgs.length > 0) {
			const item = reversedArgs.shift();
			if (item !== undefined) {
				filteredArgs.push(item, ...reversedArgs);
				break;
			}
		}

		// @ts-ignore
		data = filteredArgs.toReversed();
	}

	return data.map((item) => {
		// Serialize functions
		if (typeof item === 'function') {
			const fn = item.toString();
			logger('serialize function: %s', fn);
			return `javascript:${fn}`;
		}

		// Serialize Uint8Array
		if (item instanceof Uint8Array) {
			logger('serialize Uint8Array(%d)', item.length);
			const obj = Object.fromEntries(item.entries());
			// @ts-ignore
			obj.__Uint8Array__ = true;
			return obj;
		}

		return item;
	});
}
