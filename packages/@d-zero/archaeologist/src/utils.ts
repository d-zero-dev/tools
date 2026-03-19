import c from 'ansi-colors';

/**
 * 一致率をパーセント表示し、閾値に基づいて色付けする
 * @param matches - 一致率（0〜1の範囲）
 * @param threshold - 合格とみなす閾値（超えると緑、以下は赤）
 * @returns ANSI色付きのパーセント文字列
 */
export function score(matches: number, threshold: number) {
	const color = matches > threshold ? c.green : c.red;
	const num = (matches * 100).toFixed(1);
	return c.bold(color(`${num}%`));
}
