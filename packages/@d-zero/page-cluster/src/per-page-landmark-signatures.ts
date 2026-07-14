import type { ExtractLandmarksResult, LandmarkType } from './extract-landmarks.js';
import type { TokenizeOptions } from './types.js';

import { canonicalizeTokenSet } from './canonicalize-token-set.js';
import { tokenize } from './tokenize.js';

/**
 * Every landmark type extractLandmarks may populate, iterated in a fixed
 * order so downstream signature vectors are byte-stable and every consumer
 * agrees on the same enumeration.
 */
export const ALL_LANDMARK_TYPES: readonly LandmarkType[] = [
	'header',
	'footer',
	'nav',
	'aside',
	'form',
	'search',
];

/**
 * One landmark instance's tokenized identity: the token set produced by
 * tokenizing the instance's raw HTML wrapped in a `<body>` shell, plus that
 * token set's canonical signature string (via
 * {@link ./canonicalize-token-set.js | canonicalizeTokenSet}). Signatures
 * are reused across consumers so two callers see the same "same instance"
 * verdict without independently re-canonicalizing.
 */
export type PerPageLandmarkInstance = {
	readonly type: LandmarkType;
	readonly tokens: ReadonlySet<string>;
	readonly signature: string;
};

/**
 * Tokenizes every landmark instance across every page once, keyed by page
 * index. Shared by:
 * - {@link ./merge-cross-block-clusters.js | shellQuorum} — for cross-block
 *   shell corroboration
 * - {@link ./resolve-page-cluster-keys.js | computeLocalLandmarkPseudoTokens}
 *   — for injecting local-chrome pseudo-tokens into Stage A block token
 *   sets
 * - {@link ./resolve-landmark-variant-keys.js | resolveLandmarkVariantKeys}
 *   — for picking each page's canonical instance for variant clustering
 *
 * Every consumer previously reimplemented this loop, which was both a
 * duplication risk (a tokenization fix landing in one but not the others)
 * and a real performance cost — every landmark region on the page was
 * tokenized 2 or 3 times per pipeline invocation. This single pass replaces
 * all of that.
 *
 * Within each page, instances that tokenize to the same signature are
 * deduped (kept once): a CMS glitch that duplicates the site footer, or a
 * `<header role="navigation">` matching both `header` and `nav` at
 * identical spans, must not count twice against the corpus histogram.
 * Across pages there is no dedupe — each page contributes its own instance
 * list.
 * @param landmarks
 * @param tokenizeOptions
 */
export function computePerPageLandmarkInstances(
	landmarks: readonly ExtractLandmarksResult[],
	tokenizeOptions?: TokenizeOptions,
): readonly (readonly PerPageLandmarkInstance[])[] {
	return landmarks.map((entry) => {
		const seenSignatures = new Set<string>();
		const out: PerPageLandmarkInstance[] = [];
		for (const type of ALL_LANDMARK_TYPES) {
			for (const instanceHtml of entry[type]) {
				if (!instanceHtml) continue;
				const tokens = new Set(
					tokenize(`<body>${instanceHtml}</body>`, tokenizeOptions).tokens,
				);
				if (tokens.size === 0) continue;
				const signature = canonicalizeTokenSet(tokens);
				if (seenSignatures.has(signature)) continue;
				seenSignatures.add(signature);
				out.push({ type, tokens, signature });
			}
		}
		return out;
	});
}
