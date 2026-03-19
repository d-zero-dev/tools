import { createTwoFilesPatch } from 'diff';
import parse from 'parse-diff';

/**
 * 2つのテキストデータの行差分を生成し、一致率を算出する
 * @param urlA - 比較元のURL（diffヘッダーに使用）
 * @param urlB - 比較先のURL（diffヘッダーに使用）
 * @param dataA - 比較元のテキストデータ
 * @param dataB - 比較先のテキストデータ
 * @returns 差分結果（変更有無、最大行数、一致率、unified diff文字列）
 */
export function diffTree(urlA: string, urlB: string, dataA: string, dataB: string) {
	const result = createTwoFilesPatch(urlA, urlB, dataA, dataB);
	const info = parse(result)[0];

	if (!info) {
		throw new Error('Failed to parse diff');
	}

	const lineA = dataA.split('\n').length;
	const lineB = dataB.split('\n').length;
	const maxLine = Math.max(lineA, lineB);

	return {
		changed: dataA !== dataB,
		maxLine,
		matches: 1 - Math.abs((info.additions - info.deletions) / maxLine),
		result,
	};
}
