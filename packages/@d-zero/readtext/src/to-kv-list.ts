import type { KeyValue, Separator } from './types.js';

import { toList } from './to-list.js';

export function toKvList(text: string, separator: Separator = /\s+/) {
	if (separator instanceof RegExp && separator.global) {
		throw new Error('The separator must not be global');
	}

	const kvList = toList(text)
		.map((line) => {
			line = line.trim();

			if (!line) {
				return null;
			}

			const matches = line.match(separator);

			if (matches == null || matches.index == null) {
				return {
					key: line,
					value: '',
				};
			}

			const key = line.slice(0, matches.index);
			const value = line.slice(matches.index + matches[0].length);

			if (!key) {
				return null;
			}

			return {
				key,
				value,
			};
		})
		.filter<KeyValue>((kv) => !!kv);

	return kvList;
}
