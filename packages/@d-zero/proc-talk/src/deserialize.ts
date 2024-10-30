import type { log } from 'debug';

export function deserialize(data: unknown[], logger: typeof log): unknown[] {
	return data.map((item) => {
		// Deserialize functions
		if (typeof item === 'string' && item.startsWith('javascript:')) {
			logger('deserialize function: %s', item);
			return new Function(`return ${item.slice(11)}`)();
		}

		// Deserialize Uint8Array
		if (
			typeof item === 'object' &&
			// @ts-ignore
			item?.__Uint8Array__
		) {
			// @ts-ignore
			delete item.__Uint8Array__;
			const arr = Object.values(item);
			logger('deserialize Uint8Array(%d)', arr.length);
			return new Uint8Array(arr);
		}

		return item;
	});
}
