import type { TokenizeOptions } from './types.js';

import { resolveOptions } from './resolve-options.js';
import { runTokenizer } from './run-tokenizer.js';

export type { TokenizeOptions } from './types.js';

/**
 * Tokenizes the structural skeleton of an HTML document's `<body>` for
 * duplicate/near-duplicate page detection at crawl scale. This is the first
 * building block of `@d-zero/page-cluster`; MinHash/LSH-based clustering on
 * top of these tokens is added in a later package version.
 *
 * Only `<body>` is tokenized. `<head>` (title/meta/link/OGP/...) is ignored
 * entirely: `@d-zero/beholder` already extracts it comprehensively, but from
 * a live `Document` (Puppeteer/jsdom) rather than a raw HTML string, so that
 * logic can't be reused here without building a DOM — exactly what this
 * function avoids for speed. Callers who need head metadata should call
 * `@d-zero/beholder` separately.
 *
 * Visible text is discarded entirely: this function measures *structural*
 * similarity, and including per-page text would make otherwise-identical
 * templates look unique.
 *
 * The returned array intentionally does not deduplicate or
 * run-length-compress repeated paths — even though the eventual consumer
 * (a MinHash/LSH classifier) will reduce this array to a `Set` for
 * comparison, and a `Set` alone already collapses any number of repeated
 * entries. Compressing here first (e.g. `"li>a*3"`) would embed the
 * arrangement of neighboring siblings into the token string itself: a
 * `current`/`active`-style state class on exactly one sibling (its position
 * varies per page, e.g. which nav item is "current") shifts which runs are
 * adjacent, so the same template could serialize as `"li>a*2"` on one page
 * and as two separate `"li>a"` entries (split by the state-bearing sibling)
 * on another — literally different strings for what should compare equal
 * once turned into a `Set`. Leaving the array uncompressed sidesteps that
 * entirely:
 * `Set(["li>a", "li.current>a", "li>a"])` and
 * `Set(["li.current>a", "li>a", "li>a"])` are the same two-element set no
 * matter where the state class lands. If a future consumer needs a shorter
 * array for e.g. array-edit-distance comparisons on pathologically large
 * pages, that consumer should apply its own compression tuned to its own
 * needs, since compression is coupled to how the caller will read counts
 * back out again — folding that guess into this package's contract can't be
 * un-shipped later.
 * @param html
 * @param options
 * @example
 * ```ts
 * tokenize('<body><div class="card"><ul><li>A</li><li>B</li></ul></div></body>');
 * // ["body>.card>ul>li", "body>.card>ul>li"]
 * ```
 */
export function tokenize(html: string, options?: TokenizeOptions): string[] {
	return runTokenizer(html, resolveOptions(options));
}
