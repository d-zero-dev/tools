export function decodeURLSafe(url: string) {
	try {
		return decodeURI(url);
	} catch {
		return url;
	}
}
