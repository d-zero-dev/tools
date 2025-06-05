/**
 *
 * @param typeQuery
 */
export function parseTypes(typeQuery: string): string[] {
	const types = typeQuery.split(',').map((type) => type.trim());
	return types;
}
