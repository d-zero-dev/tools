/**
 * HTTPで生のHTMLソースを取得する
 * @param url - 取得対象のURL
 * @returns HTMLソース文字列
 */
export async function fetchHtml(url: string): Promise<string> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
	}
	return res.text();
}
