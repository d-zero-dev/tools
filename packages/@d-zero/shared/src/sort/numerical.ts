import { removeMatches } from '../remove-matches.js';

import { alphabeticalComparator } from './alphabetical.js';

export function numericalComparator(t1: string | null, t2: string | null): 0 | -1 | 1 {
	if (t1 == null && t2 == null) {
		return 0;
	}

	if (t1 == null) {
		return -1;
	}

	if (t2 == null) {
		return 1;
	}

	const [m1, m2] = removeMatches(t1, t2);
	const n1 = Number.parseFloat(m1);
	const n2 = Number.parseFloat(m2);
	if (Number.isFinite(n1) && Number.isFinite(n2)) {
		if (n1 === n2) {
			return 0;
		}
		if (n1 < n2) {
			return -1;
		}
		return 1;
	}

	return alphabeticalComparator(t1, t2);
}
