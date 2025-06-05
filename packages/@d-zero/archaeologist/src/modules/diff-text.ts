import { getTokenizer } from 'kuromojin';

import { diffTree } from './diff-tree.js';

const tokenizer = await getTokenizer();

/**
 *
 * @param text
 */
function tokenList(text: string) {
	return tokenizer
		.tokenize(text)
		.filter((token) => token.surface_form.trim() !== '')
		.map((token) => `${token.surface_form}:${token.pos}:${token.pos_detail_1}`);
}

/**
 *
 * @param tokens
 */
function frequencyMap(tokens: string[]) {
	const map = new Map<string, number>();

	for (const token of tokens) {
		map.set(token, (map.get(token) ?? 0) + 1);
	}

	return map
		.entries()
		.map(([token, frequency]) => `${token} x${frequency}`)
		.toArray()
		.toSorted((a, b) => a.localeCompare(b));
}

/**
 *
 * @param urlA
 * @param urlB
 * @param phraseA
 * @param phraseB
 */
export function diffText(urlA: string, urlB: string, phraseA: string, phraseB: string) {
	const tokensA = tokenList(phraseA);
	const tokensB = tokenList(phraseB);

	const frequencyMapA = frequencyMap(tokensA).join('\n');
	const frequencyMapB = frequencyMap(tokensB).join('\n');

	return diffTree(urlA, urlB, frequencyMapA, frequencyMapB);
}
