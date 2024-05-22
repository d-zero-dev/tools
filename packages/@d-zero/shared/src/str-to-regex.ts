import esr from 'escape-string-regexp';

/**
 * Converts a string pattern to a regular expression.
 *
 * @param pattern - The string pattern to convert.
 * @returns A regular expression object.
 */
export function strToRegex(pattern: string) {
	const reg = /^\/(.*)\/([gim]*)$/.exec(pattern);
	if (reg) {
		const [, regStr, flag] = reg;
		return new RegExp(regStr || '', flag);
	}

	return new RegExp(esr(pattern));
}
