import type { Change } from 'diff';

import c from 'ansi-colors';

/**
 *
 * @param blocks
 * @param remoteContent
 * @param termWidth
 */
export function generateDiff(
	blocks: Change[],
	remoteContent: string,
	termWidth: number,
): string {
	const contentMaxLineNum = remoteContent.split('\n').length;
	const output: string[] = [];
	let lineNum = 0;

	for (const block of blocks) {
		const lines = block.value.replace(/\n$/, '').split('\n');
		const start = lineNum;

		if (block.added) {
			output.push(c.green(formatLines(lines, start, termWidth)), '\n');
			lineNum += lines.length;
			continue;
		} else if (block.removed) {
			output.push(c.red(formatLines(lines, start, termWidth)), '\n');
			continue;
		}

		if (lines.length < 7) {
			output.push(c.black(formatLines(lines, start, termWidth)), '\n');
			lineNum += lines.length;
			continue;
		}

		const range = 3;
		const top = c.black(formatLines(lines.slice(0, range), start, termWidth));
		const bottom = c.black(
			formatLines(lines.slice(range * -1), start + lines.length - range, termWidth),
		);
		const hr = c.black(`\n${'─'.repeat(termWidth)}\n`);

		if (start === 0) {
			output.push(bottom, '\n');
		} else if (start + lines.length >= contentMaxLineNum - 1) {
			output.push(top, '\n');
		} else {
			output.push(top, hr, bottom, '\n');
		}

		lineNum += lines.length;
	}

	return output.join('');
}

/**
 *
 * @param lines
 * @param start
 * @param width
 */
export function formatLines(lines: string[], start: number, width: number): string {
	return lines
		.map((line, iterator) => {
			const lineNum = (start + iterator).toString().padStart(4, ' ');
			return truncateLine(`${lineNum}: ${line}`, width);
		})
		.join('\n');
}

/**
 *
 * @param line
 * @param width
 */
export function truncateLine(line: string, width: number): string {
	if (width < line.length) {
		const ellipsis = 3;
		const half = Math.floor(width / 2);
		const segment = half - ellipsis;
		const head = line.slice(0, segment);
		const tail = line.slice(segment * -1);
		line = `${head}${'.'.repeat(ellipsis * 2)}${tail}`;
	}
	return line;
}
