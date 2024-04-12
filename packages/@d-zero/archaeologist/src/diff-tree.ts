import { diffLines } from 'diff';

export function diffTree(dataA: string, dataB: string) {
	const changes = diffLines(dataA, dataB);
	const lineA = dataA.split('\n').length;
	const lineB = dataB.split('\n').length;
	const maxLine = Math.max(lineA, lineB);

	let changedLines = 0;

	const result = changes
		.map((change) => {
			if (change.added) {
				changedLines++;
				return `+${change.value}`;
			}
			if (change.removed) {
				changedLines++;
				return `-${change.value}`;
			}
			return change.value
				.split('\n')
				.map((line) => (line.trim() ? ` ${line}` : line))
				.join('\n');
		})
		.filter(Boolean)
		.join('');

	return {
		changed: changedLines > 0,
		maxLine,
		changedLines,
		matches: 1 - changedLines / maxLine,
		result,
	};
}
