/**
 * HTTPで生のHTMLソースを取得する
 *
 * URLにBasic認証情報（user:pass）が含まれている場合、
 * Authorizationヘッダーに変換して送信する。
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

	const res = await fetch(urlObj.toString(), { headers });
	if (!res.ok) {
		throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
	}
	return res.text();
}
