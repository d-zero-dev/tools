import { decodeURLSafe } from '../decode-url-safe.js';

export function alphabeticalComparator(a: string, b: string): 0 | -1 | 1 {
	a = decodeURLSafe(a.toLowerCase());
	b = decodeURLSafe(b.toLowerCase());
	if (a === b) {
		return 0;
	}

	if (a < b) {
		return -1;
	}

	return 1;
}
