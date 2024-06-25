import { createTwoFilesPatch } from 'diff';
import parse from 'parse-diff';

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
