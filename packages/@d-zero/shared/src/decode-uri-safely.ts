export function decodeURISafely(url: string) {
	try {
		return decodeURI(url);
	} catch {
		return url;
	}
}
