import type { BlockingReason } from './derive-blocking-reason.js';
import type { LandmarkType } from './extract-landmarks.js';
import type { PerPageLandmarkInstance } from './per-page-landmark-signatures.js';

import { describe, expect, test } from 'vitest';

import { buildClusterReason } from './build-cluster-reason.js';

const zeroPosition = {
	startOffset: 0,
	endOffset: 0,
	startLine: 1,
	startColumn: 1,
	endLine: 1,
	endColumn: 1,
};

/**
 *
 * @param type
 * @param tokens
 */
function instance(
	type: LandmarkType,
	tokens: readonly string[],
): PerPageLandmarkInstance {
	return {
		type,
		tokens: new Set(tokens),
		signature: [...tokens].toSorted().join('|'),
		position: zeroPosition,
	};
}

describe('buildClusterReason', () => {
	test('passes blocking and siblingClusterKeys through unchanged', () => {
		const blocking: readonly { blockKey: string; reason: BlockingReason }[] = [
			{
				blockKey: 'css:abc',
				reason: { kind: 'css', distinctiveStylesheetHrefs: ['/a.css'] },
			},
		];
		const reason = buildClusterReason({
			tokenSets: [new Set(['a'])],
			landmarkInstances: [[]],
			blocking,
			siblingClusterKeys: ['sibling-1'],
		});
		expect(reason.blocking).toBe(blocking);
		expect(reason.siblingClusterKeys).toEqual(['sibling-1']);
		expect(reason.memberCount).toBe(1);
	});

	test('structuralCoreTokens keeps only tokens shared by the quorum fraction of members', () => {
		const tokenSets = [
			new Set(['body>main>.card', 'body>main>.unique-a']),
			new Set(['body>main>.card', 'body>main>.unique-b']),
			new Set(['body>main>.card', 'body>main>.unique-c']),
		];
		const reason = buildClusterReason({
			tokenSets,
			landmarkInstances: [[], [], []],
			blocking: [],
			siblingClusterKeys: [],
		});
		expect(reason.structuralCoreTokens).toEqual(['body>main>.card']);
	});

	test('landmarks omits types with no instance on any member page', () => {
		const reason = buildClusterReason({
			tokenSets: [new Set(['a']), new Set(['a'])],
			landmarkInstances: [[], []],
			blocking: [],
			siblingClusterKeys: [],
		});
		expect(reason.landmarks).toEqual({});
	});

	test('header/footer common across all members yields chromeRate 1 and full presence', () => {
		const header = ['header>nav>a'];
		const footer = ['footer>p'];
		const landmarkInstances = Array.from({ length: 5 }, () => [
			instance('header', header),
			instance('footer', footer),
		]);
		const reason = buildClusterReason({
			tokenSets: Array.from({ length: 5 }, () => new Set(['body>main>.card'])),
			landmarkInstances,
			blocking: [],
			siblingClusterKeys: [],
		});
		expect(reason.landmarks.header?.presenceRate).toBe(1);
		expect(reason.landmarks.header?.chromeRate).toBe(1);
		expect(reason.landmarks.header?.memberCountWithInstance).toBe(5);
		expect(reason.landmarks.footer?.presenceRate).toBe(1);
		expect(reason.landmarks.footer?.chromeRate).toBe(1);
	});

	test('a landmark type present on only some members, with per-member-varying tokens, reads as partial presence and non-chrome (sidenav-style split)', () => {
		const header = ['header>nav>a'];
		const landmarkInstances = [
			[instance('header', header), instance('aside', ['aside>.promo'])],
			[instance('header', header), instance('aside', ['aside>.other'])],
			[instance('header', header)],
			[instance('header', header)],
			[instance('header', header)],
		];
		const reason = buildClusterReason({
			tokenSets: Array.from({ length: 5 }, () => new Set(['body>main>.card'])),
			landmarkInstances,
			blocking: [],
			siblingClusterKeys: [],
		});
		expect(reason.landmarks.header?.presenceRate).toBe(1);
		expect(reason.landmarks.header?.chromeRate).toBe(1);
		expect(reason.landmarks.aside?.presenceRate).toBe(0.4);
		expect(reason.landmarks.aside?.memberCountWithInstance).toBe(2);
		expect(reason.landmarks.aside?.chromeRate).toBe(0);
		expect(reason.landmarks.aside?.shellTokens).toEqual([]);
	});
});
