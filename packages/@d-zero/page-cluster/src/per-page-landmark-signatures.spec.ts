import type { ExtractLandmarksResult } from './extract-landmarks.js';

import { describe, expect, test } from 'vitest';

import { computePerPageLandmarkInstances } from './per-page-landmark-signatures.js';

const emptyLandmarks: ExtractLandmarksResult = {
	header: [],
	footer: [],
	nav: [],
	aside: [],
	form: [],
	search: [],
	remainderHtml: '',
};

const landmarksOf = (
	overrides: Partial<ExtractLandmarksResult>,
): ExtractLandmarksResult => ({
	...emptyLandmarks,
	...overrides,
});

describe('computePerPageLandmarkInstances', () => {
	test('an empty landmarks array yields an empty result', () => {
		expect(computePerPageLandmarkInstances([])).toStrictEqual([]);
	});

	test('a page with no landmarks yields an empty instance list', () => {
		const result = computePerPageLandmarkInstances([emptyLandmarks]);
		expect(result).toHaveLength(1);
		expect(result[0]).toStrictEqual([]);
	});

	test('every landmark instance across every type is returned with its tokens and signature', () => {
		const landmarks = landmarksOf({
			header: ['<header><nav>a</nav></header>'],
			footer: ['<footer><a>x</a></footer>'],
		});
		const [instances] = computePerPageLandmarkInstances([landmarks]);
		expect(instances).toHaveLength(2);
		expect(instances!.map((i) => i.type)).toStrictEqual(['header', 'footer']);
		for (const inst of instances!) {
			expect(inst.tokens.size).toBeGreaterThan(0);
			expect(inst.signature).toMatch(/^\[.*\]$/);
		}
	});

	test('duplicate signatures within one page are folded to one instance (byte-identical footer via CMS glitch)', () => {
		// Two byte-identical <footer> instances on the same page must not count
		// twice in the corpus histogram downstream — the per-page dedupe is
		// this helper's job so every consumer inherits it consistently.
		const landmarks = landmarksOf({
			footer: ['<footer><a>x</a></footer>', '<footer><a>x</a></footer>'],
		});
		const [instances] = computePerPageLandmarkInstances([landmarks]);
		expect(instances).toHaveLength(1);
		expect(instances![0]!.type).toBe('footer');
	});

	test('instances that tokenize to different sets are kept as distinct entries', () => {
		const landmarks = landmarksOf({
			nav: ['<nav><a class="one">a</a></nav>', '<nav><a class="two">b</a></nav>'],
		});
		const [instances] = computePerPageLandmarkInstances([landmarks]);
		expect(instances).toHaveLength(2);
		expect(instances![0]!.signature).not.toBe(instances![1]!.signature);
	});

	test('an instance that tokenizes to zero tokens is skipped (does not enter the signature histogram)', () => {
		// Real-crawl input for this shape is exotic (near-empty markup that
		// still parses); the invariant matters because downstream consumers
		// treat an empty-tokens instance as a shell-corroboration false-
		// positive (jaccard(∅, ∅) = 1). The helper filters it out at the
		// source so no consumer has to remember to.
		const landmarks = landmarksOf({
			nav: [''],
		});
		const [instances] = computePerPageLandmarkInstances([landmarks]);
		expect(instances).toStrictEqual([]);
	});

	test('the same signature on two different pages is not deduped across pages (per-page dedupe only)', () => {
		const html = '<header><nav>a</nav></header>';
		const [a, b] = computePerPageLandmarkInstances([
			landmarksOf({ header: [html] }),
			landmarksOf({ header: [html] }),
		]);
		expect(a).toHaveLength(1);
		expect(b).toHaveLength(1);
		expect(a![0]!.signature).toBe(b![0]!.signature);
	});

	test('landmark types are iterated in a stable order (header, footer, nav, aside, form, search)', () => {
		// Order stability matters because downstream selection ("first
		// occurrence at max frequency wins ties") relies on a deterministic
		// walk. Pin the exact order here so a future ALL_LANDMARK_TYPES
		// re-shuffle would break this test rather than silently reshaping
		// the pipeline's tie-break outcomes.
		const landmarks = landmarksOf({
			search: ['<search>s</search>'],
			form: ['<form role="form">f</form>'],
			aside: ['<aside>a</aside>'],
			nav: ['<nav>n</nav>'],
			footer: ['<footer>ft</footer>'],
			header: ['<header>h</header>'],
		});
		const [instances] = computePerPageLandmarkInstances([landmarks]);
		expect(instances!.map((i) => i.type)).toStrictEqual([
			'header',
			'footer',
			'nav',
			'aside',
			'form',
			'search',
		]);
	});
});
