import type { URLPair } from './types.js';
import type { PageHook } from '@d-zero/puppeteer-screenshot';

import c from 'ansi-colors';

import { analyze } from './analyze.js';
import { label, score } from './output-utils.js';

export async function archaeologist(
	list: readonly URLPair[],
	pageHooks?: readonly PageHook[],
) {
	const results = await analyze(list, pageHooks ?? []);

	const output: string[] = [];

	for (const result of results) {
		output.push(c.gray(`${result.target.join(' vs ')}`));
		for (const [sizeName, { matches, file }] of Object.entries(result.screenshots)) {
			output.push(`  ${label(sizeName)} ${score(matches, 0.9)} ${file}`);
		}
		output.push(
			`  ${label('HTML', c.bgBlueBright)}: ${score(result.html.matches, 0.995)} ${result.html.file}`,
		);
	}

	process.stdout.write(output.join('\n') + '\n');
}
