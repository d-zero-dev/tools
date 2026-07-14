import type { PageClusterSignals } from './resolve-page-cluster-keys.js';

import { describe, expect, test } from 'vitest';

import {
	resolvePageClusterKeys,
	resolvePageClusterKeysFromArray,
	resolvePageClusterKeysInMemory,
} from './resolve-page-cluster-keys.js';

/**
 * Builds a small `PageClusterSignals[]` fixture with three visible template
 * families and a section split so the returned cluster keys will actually
 * vary. Small enough to stay under `CORPUS_INLINE_THRESHOLD`.
 */
function buildTinyCorpus(): PageClusterSignals[] {
	const pages: PageClusterSignals[] = [];
	// news template A
	for (let i = 0; i < 3; i++) {
		pages.push({
			paths: ['news', String(i)],
			stylesheetHrefs: ['https://x.example.com/news.css'],
			html: `<body><article><h1>News ${i}</h1><p>body</p></article><footer>f</footer></body>`,
		});
	}
	// about page
	pages.push(
		{
			paths: ['about'],
			stylesheetHrefs: ['https://x.example.com/about.css'],
			html: `<body><section><h1>About</h1><p>text</p></section><footer>f</footer></body>`,
		},
		{
			paths: ['contact'],
			stylesheetHrefs: ['https://x.example.com/contact.css'],
			html: `<body><form><label>Name</label><input><button>Send</button></form></body>`,
		},
	);
	return pages;
}

describe('resolvePageClusterKeys (async factory)', () => {
	test('empty input returns empty result', async () => {
		const keys = await resolvePageClusterKeys(() => []);
		expect(keys).toEqual([]);
	});

	test('small corpus matches resolvePageClusterKeysInMemory exactly', async () => {
		const pages = buildTinyCorpus();
		const streamed = await resolvePageClusterKeys(() => pages);
		const inMemory = resolvePageClusterKeysInMemory(pages);
		expect(streamed).toEqual(inMemory);
	});

	test('async iterable factory works', async () => {
		const pages = buildTinyCorpus();
		/**
		 *
		 */
		async function* asyncPages(): AsyncGenerator<PageClusterSignals> {
			for (const page of pages) {
				// An `await` on any expression suffices to make this a valid
				// async generator per @typescript-eslint/require-await; passing
				// a resolved Promise keeps behavior identical to a plain yield.
				yield await Promise.resolve(page);
			}
		}
		const streamed = await resolvePageClusterKeys(() => asyncPages());
		const inMemory = resolvePageClusterKeysInMemory(pages);
		expect(streamed).toEqual(inMemory);
	});

	test('single-shot factory (small corpus stays under threshold, factory invoked twice)', async () => {
		let calls = 0;
		const pages = buildTinyCorpus();
		/**
		 *
		 */
		function factory() {
			calls++;
			return pages;
		}
		await resolvePageClusterKeys(factory);
		// Small corpus takes the in-memory path, which invokes the factory
		// exactly twice (once for blocking signals, once for full pages).
		expect(calls).toBe(2);
	});
});

describe('resolvePageClusterKeysFromArray', () => {
	test('produces the same result as resolvePageClusterKeysInMemory on the same input', async () => {
		const pages = buildTinyCorpus();
		const fromArray = await resolvePageClusterKeysFromArray(pages);
		const inMemory = resolvePageClusterKeysInMemory(pages);
		expect(fromArray).toEqual(inMemory);
	});

	test('empty input returns empty', async () => {
		expect(await resolvePageClusterKeysFromArray([])).toEqual([]);
	});
});
