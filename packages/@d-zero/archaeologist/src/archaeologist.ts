import type { AnalyzeOptions } from './analyze.js';
import type { URLPair } from './types.js';

import c from 'ansi-colors';

import { analyze } from './analyze.js';
import { label, score } from './output-utils.js';

export interface ArchaeologistOptions extends AnalyzeOptions {}

export async function archaeologist(
	list: readonly URLPair[],
	options?: ArchaeologistOptions,
) {
	const results = await analyze(list, options);

	const output: string[] = [];

	for (const result of results) {
		output.push(c.gray(`${result.target.join(' vs ')}`));
		for (const [sizeName, { image, dom }] of Object.entries(result.screenshots)) {
			if (image) {
				const { matches, file } = image;
				output.push(`  ${label(sizeName)} ${score(matches, 0.9)} ${file}`);
			}
			output.push(
				`  ${label('HTML', c.bgBlueBright)}: ${score(dom.matches, 0.995)} ${dom.file}`,
			);
		}
	}

	process.stdout.write(output.join('\n') + '\n');
}
