export function scNumberComparator(a: string | null, b: string | null) {
	if (a === b) {
		return 0;
	}

	if (a === null) {
		return 1;
	}

	if (b === null) {
		return -1;
	}

	const _a = a.split('.').map((n) => Number.parseInt(n));
	const _b = b.split('.').map((n) => Number.parseInt(n));

	if (_a[0] !== _b[0]) {
		return (_a[0] ?? 0) - (_b[0] ?? 0);
	}

	if (_a[1] !== _b[1]) {
		return (_a[1] ?? 0) - (_b[1] ?? 0);
	}

	return (_a[2] ?? 0) - (_b[2] ?? 0);
}
