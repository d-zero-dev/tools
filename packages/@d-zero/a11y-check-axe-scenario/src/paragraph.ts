/**
 *
 * @param {...(string | null | undefined)} texts
 */
export function p(...texts: (string | null | undefined)[]) {
	return texts.filter(Boolean).join('\n\n');
}

/**
 *
 * @param {...(string | null | undefined)} texts
 */
export function br(...texts: (string | null | undefined)[]) {
	return texts.filter(Boolean).join('\n');
}
