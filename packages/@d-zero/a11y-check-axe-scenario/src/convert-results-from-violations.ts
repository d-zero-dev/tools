import type { AxeRuleId } from './types.js';
import type { Violation } from '@d-zero/a11y-check-core';
import type { AxeResults } from 'axe-core';
import type { Page } from 'puppeteer';

import { convertResultsFromNode } from './convert-results-from-node.js';
import { detectLevel } from './detect-level.js';
import { detectSeverity } from './detect-severity.js';
import { inferExplanation } from './infer-explanation.js';
import { p } from './paragraph.js';
import { tagsToSCs } from './tags-to-scs.js';

/**
 *
 * @param page
 * @param axeResults
 * @param sizeName
 * @param screenshot
 * @param log
 */
export async function convertResultsFromViolations(
	page: Page,
	axeResults: AxeResults,
	sizeName: string,
	screenshot: boolean,
	log: (log: string) => void,
): Promise<Violation[]> {
	const results: Violation[] = [];

	const violations = [...axeResults.incomplete, ...axeResults.violations];

	for (const violation of violations) {
		const nodeResults = violation.nodes;
		for (const node of nodeResults) {
			const nodeResult = await convertResultsFromNode(page, node, screenshot, log);
			const explanation = inferExplanation(
				violation.id as AxeRuleId,
				node,
				nodeResult?.style ?? null,
			);

			results.push({
				id: '',
				url: page.url(),
				tool: `${axeResults.testEngine.name} (v${axeResults.testEngine.version})`,
				timestamp: new Date(axeResults.timestamp),
				component: nodeResult?.landmark ?? null,
				environment: sizeName,
				targetNode: {
					value: node.html,
				},
				asIs: {
					value: p(
						`${violation.help}\n(${violation.helpUrl})`,
						violation.description,
						node.failureSummary,
					),
				},
				toBe: {
					value: p(explanation?.main),
				},
				explanation: {
					value: p(explanation?.help),
				},
				wcagVersion: violation.tags.includes('wcag2a') ? 'WCAG2.0' : 'WCAG2.1',
				scNumber: tagsToSCs(violation.tags),
				level: detectLevel(violation.tags),
				severity: detectSeverity(violation.impact),
				screenshot: nodeResult?.screenshot ?? null,
			});
		}
	}

	return results;
}
