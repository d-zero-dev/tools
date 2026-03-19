/**
 * HTTPで生のHTMLソースを取得する
 *
 * URLにBasic認証情報（user:pass）が含まれている場合、
 * Authorizationヘッダーに変換して送信する。
 * リダイレクト先でも認証ヘッダーを維持するため、リダイレクトを手動で追跡する。
 * @param url - 取得対象のURL
 * @returns HTMLソース文字列
 */
export async function fetchHtml(url: string): Promise<string> {
	const urlObj = new URL(url);
	const headers: Record<string, string> = {};

	if (urlObj.username || urlObj.password) {
		const credentials = btoa(`${urlObj.username}:${urlObj.password}`);
		headers['Authorization'] = `Basic ${credentials}`;
		urlObj.username = '';
		urlObj.password = '';
	}

	const maxRedirects = 10;
	let target = urlObj.toString();

	for (let i = 0; i <= maxRedirects; i++) {
		const res = await fetch(target, { headers, redirect: 'manual' });

		if (res.status >= 300 && res.status < 400) {
			const location = res.headers.get('location');
			if (!location) {
				throw new Error(`Redirect without Location header from ${target}`);
			}
			target = new URL(location, target).toString();
			continue;
		}

		if (!res.ok) {
			throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
		}
		return res.text();
	}

	throw new Error(`Too many redirects fetching ${url}`);
}
