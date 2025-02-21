/**
 *
 * @param {...any} texts
 */
export function p(...texts: (string | null | undefined)[]) {
	return texts.filter(Boolean).join('\n\n');
}

/**
 *
 * @param {...any} texts
 */
export function br(...texts: (string | null | undefined)[]) {
	return texts.filter(Boolean).join('\n');
}
