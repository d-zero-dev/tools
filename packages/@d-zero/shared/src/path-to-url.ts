export function pathToURL(path: string): URL {
	try {
		return new URL(path);
	} catch (error) {
		if (error instanceof TypeError) {
			return new URL(path, 'file://');
		}
		throw error;
	}
}
