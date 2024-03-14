import type { Separator } from './types.js';

import { readList } from './read-list.js';

export async function readGrid<Row extends string[]>(
	filePath: string,
	separator: Separator = '\t',
): Promise<ReadonlyArray<Row>> {
	const list = await readList(filePath);
	const grid = list.map<Row>((line) =>
		// @ts-ignore
		line
			.split(separator)
			//
			.map((cell) => cell.trim()),
	);
	return grid;
}
