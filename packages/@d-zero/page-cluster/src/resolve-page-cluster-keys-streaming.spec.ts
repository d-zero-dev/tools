import type { ClusterReason } from './build-cluster-reason.js';
import type { PageClusterSignals, ProgressEvent } from './resolve-page-cluster-keys.js';

import { describe, expect, test } from 'vitest';

import {
	CORPUS_INLINE_THRESHOLD,
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

describe('resolvePageClusterKeys onProgress on small corpus', () => {
	test('emits pass1-block-complete once per block with monotonic blocksProcessed', async () => {
		const pages = buildTinyCorpus();
		const events: ProgressEvent[] = [];
		await resolvePageClusterKeys(() => pages, {
			onProgress: (event) => events.push(event),
		});

		// `buildTinyCorpus()` yields three distinct blocking groups (`news`,
		// `about`, `contact` — each has its own stylesheet host / path shape),
		// so the streaming resolver processes exactly three blocks and
		// emits `pass1-block-complete` three times with `blocksProcessed`
		// values 1, 2, 3 in order and `totalBlocks` constant at 3. Hardcoded
		// literals (instead of `map((_, i) => i + 1)`) so a regression that
		// changes emission count is caught by a mismatch rather than a
		// coincidentally-generated matching array.
		const pass1Events = events.filter((e) => e.phase === 'pass1-block-complete');
		expect(pass1Events).toHaveLength(3);
		expect(pass1Events.map((e) => e.blocksProcessed)).toEqual([1, 2, 3]);
		expect(pass1Events.map((e) => e.totalBlocks)).toEqual([3, 3, 3]);
	});

	test('emits stage-b-start exactly once after all blocks complete', async () => {
		const pages = buildTinyCorpus();
		const events: ProgressEvent[] = [];
		await resolvePageClusterKeys(() => pages, {
			onProgress: (event) => events.push(event),
		});

		const stageBIndex = events.findIndex((e) => e.phase === 'stage-b-start');
		expect(stageBIndex).toBeGreaterThan(-1);
		expect(events.filter((e) => e.phase === 'stage-b-start')).toHaveLength(1);
		// Every pass1-block-complete must precede stage-b-start.
		const pass1Count = events.filter((e) => e.phase === 'pass1-block-complete').length;
		const pass1IndicesBeforeStageB = events
			.slice(0, stageBIndex)
			.filter((e) => e.phase === 'pass1-block-complete').length;
		expect(pass1IndicesBeforeStageB).toBe(pass1Count);
	});

	test('result with onProgress is byte-for-byte identical to resolvePageClusterKeysInMemory', async () => {
		const pages = buildTinyCorpus();
		const withProgress = await resolvePageClusterKeys(() => pages, {
			onProgress: () => {
				// discard; only the return value matters here
			},
		});
		const inMemory = resolvePageClusterKeysInMemory(pages);
		expect(withProgress).toEqual(inMemory);
	});

	test('no onProgress delegates to sync in-memory path (no yield overhead)', async () => {
		// Regression guard for the deliberate short-circuit that keeps
		// library-only callers on the pre-refactor code path. The clearest
		// black-box signal is that the sync `resolvePageClusterKeysInMemory`
		// helper is what produces the reference keys — so asserting equality
		// against it (rather than a hand-written expected array) is what
		// documents the intended equivalence.
		const pages = buildTinyCorpus();
		const withoutProgress = await resolvePageClusterKeys(() => pages);
		const inMemory = resolvePageClusterKeysInMemory(pages);
		expect(withoutProgress).toEqual(inMemory);
	});
});

describe('resolvePageClusterKeys (onClusterReason)', () => {
	test('small corpus with onClusterReason produces the same keys and reasons as resolvePageClusterKeysInMemory', async () => {
		const pages = buildTinyCorpus();
		const streamedReasons = new Map<string, ClusterReason>();
		const streamed = await resolvePageClusterKeys(() => pages, {
			onClusterReason: (key, reason) => streamedReasons.set(key, reason),
		});
		const inMemoryReasons = new Map<string, ClusterReason>();
		const inMemory = resolvePageClusterKeysInMemory(pages, {
			onClusterReason: (key, reason) => inMemoryReasons.set(key, reason),
		});
		expect(streamed).toEqual(inMemory);
		expect(streamedReasons).toEqual(inMemoryReasons);
		expect(streamedReasons.size).toBeGreaterThan(0);
	});

	test('combined with onProgress on a small corpus, fires both onClusterReason and progress events, with matching reasons and keys to the sync path', async () => {
		const pages = buildTinyCorpus();
		const events: ProgressEvent[] = [];
		const reasons = new Map<string, ClusterReason>();
		const result = await resolvePageClusterKeys(() => pages, {
			onClusterReason: (key, reason) => reasons.set(key, reason),
			onProgress: (event) => events.push(event),
		});

		const inMemoryReasons = new Map<string, ClusterReason>();
		const inMemory = resolvePageClusterKeysInMemory(pages, {
			onClusterReason: (key, reason) => inMemoryReasons.set(key, reason),
		});
		expect(result).toEqual(inMemory);
		expect(reasons).toEqual(inMemoryReasons);
		expect(reasons.size).toBeGreaterThan(0);

		expect(events.some((e) => e.phase === 'pass1-block-complete')).toBe(true);
		expect(events.filter((e) => e.phase === 'stage-b-start')).toHaveLength(1);
	});

	test('a corpus above CORPUS_INLINE_THRESHOLD completes on the streaming path and fires onClusterReason once per final cluster, without throwing', async () => {
		// Regression guard for the fixed design flaw this replaces: the old
		// `includeLandmarkPositions` retained every member page's landmark
		// data until final clustering completed, which is why it had to
		// reject corpora over this threshold outright. `ClusterReason` is
		// sized by cluster count, not page count, so it has no such ceiling —
		// this test's whole point is proving that by actually crossing the
		// threshold instead of asserting a thrown error.
		const bigCount = CORPUS_INLINE_THRESHOLD + 1;
		/**
		 * @yields {PageClusterSignals} A minimal page, `bigCount` times.
		 */
		function* generate(): Generator<PageClusterSignals> {
			for (let i = 0; i < bigCount; i++) {
				yield { paths: ['p', String(i)], stylesheetHrefs: [], html: '<body></body>' };
			}
		}
		const reasons = new Map<string, ClusterReason>();
		const keys = await resolvePageClusterKeys(() => generate(), {
			onClusterReason: (key, reason) => reasons.set(key, reason),
		});
		expect(keys).toHaveLength(bigCount);
		const distinctKeys = new Set(keys);
		expect(reasons.size).toBe(distinctKeys.size);
		for (const key of distinctKeys) expect(reasons.has(key)).toBe(true);
	}, 30_000);

	test('Pass 1b tokenizes non-sample pages with the allowedClasses learned from the block sample', async () => {
		// Every page carries a page-unique label on the wrapper right under
		// <body>, so with the label kept every root-to-leaf path of the page
		// differs from every other page's (Jaccard 0 against every sample
		// member). The 100-page reservoir sample sees each label once, learns
		// `wrap` / `listing` as the recurring classes and strips the labels;
		// the ~19,900 non-sample pages are only assigned correctly if Pass 1b
		// applies that same set — tokenized without it they would all tie at
		// score 0 and fall into whichever cluster is iterated first.
		const bigCount = CORPUS_INLINE_THRESHOLD + 1;
		/**
		 * @yields {PageClusterSignals} Two templates alternating by index, `bigCount` times.
		 */
		function* generate(): Generator<PageClusterSignals> {
			for (let i = 0; i < bigCount; i++) {
				const inner =
					i % 2 === 0
						? '<article><h2>t</h2><section><h3>h</h3><p>x</p><img></section></article>'
						: '<ul class="listing"><li><a>a</a></li><li><a>b</a></li><li><a>c</a></li></ul><form><input><button>go</button></form>';
				yield {
					paths: ['p', String(i)],
					stylesheetHrefs: [],
					html: `<body><div class="wrap u-${i}">${inner}</div></body>`,
				};
			}
		}
		const keys = await resolvePageClusterKeys(() => generate());
		expect(keys).toHaveLength(bigCount);
		const articleKeys = new Set(keys.filter((_, i) => i % 2 === 0));
		const listingKeys = new Set(keys.filter((_, i) => i % 2 === 1));
		expect(articleKeys.size).toBe(1);
		expect(listingKeys.size).toBe(1);
		expect(new Set(keys).size).toBe(2);
	}, 60_000);
});

describe('resolvePageClusterKeys (content root on the streaming path)', () => {
	const tags = [
		'em',
		'strong',
		'b',
		'i',
		'u',
		'code',
		'kbd',
		'samp',
		'var',
		'mark',
		'q',
		's',
	];

	/**
	 * @param count
	 * @yields {PageClusterSignals} Two alternating templates under `<div id="page">`
	 *   (not a built-in anchor), differing per page only in a tag below the
	 *   depth where the cap applies.
	 */
	function* generate(count: number): Generator<PageClusterSignals> {
		for (let i = 0; i < count; i++) {
			const tag = tags[i % tags.length]!;
			// Each template has its own wrapper id (neither is a built-in
			// anchor), so a page is capped only if it is capped with *its own*
			// hint: the other template's hint matches nothing on it.
			const isFirstTemplate = i % 2 === 0;
			const wrapperId = isFirstTemplate ? 'pageA' : 'pageB';
			const inner = isFirstTemplate
				? `<section><article><div><${tag}>x</${tag}></div></article></section>`
				: `<ul><li><a><${tag}>x</${tag}></a></li></ul>`;
			yield {
				paths: ['p', String(i)],
				stylesheetHrefs: [],
				html: `<body><div id="${wrapperId}">${inner}</div></body>`,
				contentRoot: { id: wrapperId },
			};
		}
	}

	test('Pass 1b caps non-sample pages with their own hint at the depth learned from the sample', async () => {
		// The 100-page reservoir sample learns the cap depth (3) with the hint
		// and holds the capped tokens of both templates. The ~19,900 non-sample
		// pages are only assigned to the right template if Pass 1b caps them the
		// same way: uncapped they share no token with any capped sample member,
		// every similarity is 0, and they would all fall into whichever cluster
		// is compared first.
		const count = CORPUS_INLINE_THRESHOLD + 1;
		const keys = await resolvePageClusterKeys(() => generate(count));
		expect(keys).toHaveLength(count);
		expect(new Set(keys.filter((_, i) => i % 2 === 0)).size).toBe(1);
		expect(new Set(keys.filter((_, i) => i % 2 === 1)).size).toBe(1);
		expect(new Set(keys).size).toBe(2);
	}, 90_000);

	test('the small-corpus path keeps the hint when it re-reads the factory', async () => {
		const pages = [...generate(24)];
		const streamed = await resolvePageClusterKeysFromArray(pages);
		expect(streamed).toStrictEqual(resolvePageClusterKeysInMemory(pages));
		expect(new Set(streamed).size).toBe(2);
	});

	test('the progress-reporting small-corpus path also keeps the hint', async () => {
		// Passing `onProgress` selects a different in-memory driver than the
		// no-callback case above, with its own per-block Stage A call.
		const events: string[] = [];
		const keys = await resolvePageClusterKeys(() => generate(24), {
			onProgress: (event) => events.push(event.phase),
		});
		expect(events).toContain('stage-b-start');
		expect(new Set(keys).size).toBe(2);
		expect(keys).toStrictEqual(resolvePageClusterKeysInMemory([...generate(24)]));
	});
});
