import { readGrid } from '@d-zero/readtext/grid';

import { compare } from './compare.js';

/**
 * Options for file matching.
 */
type Options = {
	verbose?: boolean;
};

/**
 * Compares two files and returns a boolean indicating whether they match or not.
 *
 * @param file1 - The path to the first file.
 * @param file2 - The path to the second file.
 * @param options - Optional options for the file comparison.
 * @returns A Promise that resolves to a boolean indicating whether the files match or not.
 */
export async function filematch(file1: string, file2: string, options?: Options) {
	const result = await compare(file1, file2, (progress) => {
		if (!options?.verbose) return;
		const progressPercentage = (progress * 100).toFixed(2);
		process.stdout.write(`${progressPercentage}% ${file1} ${file2}\n`);
	});

	process.stdout.write(`${result ? '✅' : '❌'} ${file1} ${file2}\n`);
}

/**
 * Matches files from a list of file patterns and performs a file match operation for each pair.
 *
 * @param list - The list of file patterns to match.
 * @param options - The options for the file match operation.
 * @returns A promise that resolves when all file match operations are completed.
 */
export async function filematchFromList(
	list: readonly [string, string][],
	options?: Options,
) {
	await Promise.all(list.map((pair) => filematch(pair[0], pair[1], options)));
}

/**
 * Reads a list file and performs file matching based on the list.
 *
 * @param filePath - The path to the list file.
 * @param options - Optional options for file matching.
 * @returns A promise that resolves when the file matching is complete.
 */
export async function filematchFromListFile(filePath: string, options?: Options) {
	const list = await readGrid<[string, string]>(filePath, /\s+/);
	await filematchFromList(list, options);
}
