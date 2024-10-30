import type { A11yCheckOptions } from './types.js';

import { scenarioAxe } from '@d-zero/a11y-check-axe-scenario';
import { scenarioRunner } from '@d-zero/a11y-check-core';
import { scenario01, scenario02 } from '@d-zero/a11y-check-scenarios';
import dayjs from 'dayjs';

import { SpreadsheetReporter } from './spreadsheet.js';

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
		const sheetName = dayjs().format('YYYY-MM-DD');
		sheet = await SpreadsheetReporter.setup(out, sheetName);
	}

	const result = await scenarioRunner(
		urlList,
		[
			//
			scenarioAxe(options),
			scenario01(options),
			scenario02(options),
		],
		{
			...options,
		},
	);

	if (out && sheet) {
		process.stdout.write(`Report to ${out}\n`);
		await sheet.report(result.violations);
	}
}
