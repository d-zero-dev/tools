import type { Violation } from '@d-zero/a11y-check-core';
import type { Auth } from '@d-zero/google-auth';

import { authentication } from '@d-zero/google-auth';
import { SheetTable } from '@d-zero/google-sheets';
import { parseUrl } from '@d-zero/shared/parse-url';
import dotenv from 'dotenv';

export class SpreadsheetReporter {
	#table: SheetTable<Violation> | null = null;

	// eslint-disable-next-line no-restricted-syntax
	private constructor() {}

	async report(results: readonly Violation[]) {
		if (!this.#table) {
			throw new Error('Table is not created');
		}

		await this.#table.addRecords(
			results.map((result) => {
				const url = parseUrl(result.url);

				return {
					id: { value: result.id },
					url: {
						value: url.withoutHashAndAuth,
						textFormat: { link: { uri: url.withoutHashAndAuth } },
					},
					tool: { value: result.tool },
					timestamp: { value: result.timestamp },
					component: { value: result.component },
					environment: { value: result.environment },
					targetNode: {
						value: result.targetNode.value,
						note: result.targetNode.note,
					},
					asIs: { value: result.asIs.value, note: result.asIs.note },
					toBe: { value: result.toBe.value, note: result.toBe.note },
					explanation: {
						value: result.explanation.value,
						note: result.explanation.note,
					},
					wcagVersion: { value: result.wcagVersion },
					scNumber: { value: result.scNumber },
					level: { value: result.level },
					severity: { value: result.severity },
					screenshot: { value: result.screenshot },
				};
			}),
		);
	}

	async #create(sheetUrl: string, sheetName: string, auth: Auth) {
		this.#table = await SheetTable.create<Violation>(
			sheetUrl,
			sheetName,
			auth,
			{
				define: {
					id: 'No.',
					url: '対象画面URL',
					tool: 'テスト方法',
					timestamp: '日時',
					component: 'パーツ',
					environment: '環境',
					targetNode: '対象箇所',
					asIs: 'AS IS',
					toBe: {
						label: 'TO BE',
						conditionalFormatRules: [
							{
								booleanRule: {
									condition: { type: 'BLANK' },
									format: {
										backgroundColor: { red: 0.9 },
										textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 } },
									},
								},
							},
						],
					},
					explanation: {
						label: 'TO BE(補足)',
						conditionalFormatRules: [
							{
								booleanRule: {
									condition: {
										type: 'TEXT_STARTS_WITH',
										values: [{ userEnteredValue: 'N/A' }],
									},
									format: {
										backgroundColor: { red: 0.9 },
										textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 } },
									},
								},
							},
							{
								booleanRule: {
									condition: {
										type: 'TEXT_STARTS_WITH',
										values: [{ userEnteredValue: 'WARNING' }],
									},
									format: {
										backgroundColor: { red: 1, green: 0.5, blue: 0 },
										textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 } },
									},
								},
							},
						],
					},
					wcagVersion: 'WCAGバージョン',
					scNumber: '達成基準番号',
					level: '適合レベル',
					severity: '深刻度',
					screenshot: 'スクリーンショット',
				},
			},
			{
				frozen: {
					rows: 1,
					cols: 2,
				},
			},
		);
	}

	static async setup(sheetUrl: string, sheetName: string, credentialFilePath?: string) {
		dotenv.config();

		const auth = await authentication(credentialFilePath ?? null, [
			'https://www.googleapis.com/auth/spreadsheets',
		]);

		const reporter = new SpreadsheetReporter();
		await reporter.#create(sheetUrl, sheetName, auth);
		return reporter;
	}
}
