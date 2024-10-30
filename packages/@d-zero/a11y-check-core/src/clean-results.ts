import type { Violation } from './types.js';

import { hash } from '@d-zero/shared/hash';
import { pathComparator } from '@d-zero/shared/sort/path';

import { scNumberComparator } from './sc-number-comparator.js';

export function cleanResults(results: readonly Violation[]) {
	const hashMap = new Map<string, Violation>();

	for (const result of results) {
		const content = [
			result.url,
			result.component ?? '',
			result.targetNode.value,
			result.targetNode.note ?? '',
		].join('');

		const name = hash(content);

		if (hashMap.has(name)) {
			const existing = hashMap.get(name)!;

			if (!existing.environment.includes(result.environment)) {
				hashMap.set(name, {
					...existing,
					environment: existing.environment + '\n' + result.environment,
				});
			}

			continue;
		}

		hashMap.set(name, result);
	}

	return [...hashMap.values()]
		.toSorted((a, b) => scNumberComparator(a.scNumber, b.scNumber))
		.toSorted((a, b) => pathComparator(a.url, b.url));
}
