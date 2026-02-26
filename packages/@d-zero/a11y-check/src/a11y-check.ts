import type { A11yCheckOptions } from './types.js';

import { scenarioAxe } from '@d-zero/a11y-check-axe-scenario';
import { scenarioRunner } from '@d-zero/a11y-check-core';
import { scenario01, scenario02 } from '@d-zero/a11y-check-scenarios';
import dayjs from 'dayjs';

import { SpreadsheetReporter } from './spreadsheet.js';

/**
 *
 * @param urlList
 * @param out
 * @param options
 */
export async function a11yCheck(
	urlList: readonly (
		| string
		| {
				id: string | null;
				url: string;
		  }
	)[],
	out?: string,
	options?: A11yCheckOptions,
) {
	let sheet: SpreadsheetReporter | null = null;
	if (out) {
		let sheetName = dayjs().format('YYYY-MM-DD');

		if (options?.debug) {
			sheetName += `-debug-${Date.now()}`;
		}

		sheet = await SpreadsheetReporter.setup(out, sheetName, options?.credentials);
	}

	const scenarioList = options?.scenarios ?? ['axe'];

	const scenarios = scenarioList.map((s) => {
		switch (s) {
			case 'axe': {
				return scenarioAxe(options);
			}
			case '01': {
				return scenario01(options);
			}
			case '02': {
				return scenario02(options);
			}
			default: {
				throw new Error(`Unknown scenario: ${s}`);
			}
		}
	});

	const result = await scenarioRunner(urlList, scenarios, options);

	if (out && sheet) {
		process.stdout.write(`Report to ${out}\n`);
		await sheet.report(result.violations);
	}
}
