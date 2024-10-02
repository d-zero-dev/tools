export function removeAuth(url: string) {
	const urlWithoutAuth = url.replace(/^(https?:\/\/)[^/]+@/, '$1');
	return urlWithoutAuth;
}
