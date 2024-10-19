import { decodeURISafely } from '../decode-uri-safely.js';

export function alphabeticalComparator(a: string, b: string): 0 | -1 | 1 {
	a = decodeURISafely(a.toLowerCase());
	b = decodeURISafely(b.toLowerCase());
	if (a === b) {
		return 0;
	}

	if (a < b) {
		return -1;
	}

	return 1;
}
