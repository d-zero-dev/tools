/**
 *
 * @param listParam
 */
export function parseList(listParam: string): string[] {
	const list = listParam.split(',').map((value) => value.trim());
	return list;
}
