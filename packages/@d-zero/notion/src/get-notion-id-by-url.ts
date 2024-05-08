export function getNotionIdByURL(url: string) {
	const urlObject = new URL(url);
	const path = urlObject.pathname.trim();
	if (!path) {
		throw new Error(`Invalid URL: ${url}`);
	}

	const id = path.split('/').pop();
	if (!id) {
		throw new Error(`Invalid URL: ${url}`);
	}

	return id;
}
