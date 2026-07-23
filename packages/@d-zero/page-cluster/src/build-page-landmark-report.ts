import type {
	ExtractLandmarksResult,
	LandmarkInstance,
	LandmarkPosition,
} from './extract-landmarks.js';
import type { TokenizeOptions } from './types.js';

import { isChromeLandmarkInstance } from './is-chrome-landmark-instance.js';
import { ALL_LANDMARK_TYPES } from './per-page-landmark-signatures.js';
import { tokenize } from './tokenize.js';

/**
 * A landmark instance's position plus whether
 * {@link ./is-chrome-landmark-instance.js | isChromeLandmarkInstance} judged
 * it shared site/section chrome (`true`) or page-specific content (`false`),
 * against the unit's {@link ./shell-quorum.js | shellQuorum} shell tokens.
 */
export type ReportedLandmarkInstance = LandmarkPosition & { readonly isChrome: boolean };

/**
 * Per-page landmark position report built by
 * {@link ./build-page-landmark-report.js | buildPageLandmarkReport}. `main`
 * carries no `isChrome` verdict — it never participates in chrome/shell
 * discovery (see `extractLandmarks`'s "main handling" note) and is always
 * content.
 */
export type PageLandmarkReport = {
	header: ReportedLandmarkInstance[];
	footer: ReportedLandmarkInstance[];
	nav: ReportedLandmarkInstance[];
	aside: ReportedLandmarkInstance[];
	form: ReportedLandmarkInstance[];
	search: ReportedLandmarkInstance[];
	main: LandmarkPosition[];
};

/**
 * Strips `html` off a {@link LandmarkInstance}, keeping only its position.
 * `buildPageLandmarkReport`'s output is meant to be serialized per page
 * across a whole corpus (the CLI's JSONL output), so the report
 * deliberately excludes each instance's raw HTML to keep that payload from
 * scaling with markup size — callers who also need the HTML already have
 * `ExtractLandmarksResult` in hand.
 * @param instance
 */
function toPosition(instance: LandmarkInstance): LandmarkPosition {
	return {
		startOffset: instance.startOffset,
		endOffset: instance.endOffset,
		startLine: instance.startLine,
		startColumn: instance.startColumn,
		endLine: instance.endLine,
		endColumn: instance.endColumn,
	};
}

/**
 * Builds a page's landmark position report: every landmark instance's
 * location, with `header`/`footer`/`nav`/`aside`/`form`/`search` instances
 * additionally classified as chrome or content against `shellTokens`.
 *
 * Reads `landmarks` directly — the full, non-deduplicated instance list
 * `extractLandmarks` produced — rather than going through
 * {@link ./per-page-landmark-signatures.js | computePerPageLandmarkInstances}'s
 * per-page-deduplicated `PerPageLandmarkInstance[]`: that dedupe collapses
 * same-signature instances to one entry, which would silently drop the
 * position of every duplicate instance a position report needs to include.
 * @param landmarks
 * @param shellTokens The unit-level shell token set from
 * {@link ./shell-quorum.js | shellQuorum}, computed once per final cluster
 * and shared across every member page's report.
 * @param tokenizeOptions
 * @example
 * ```ts
 * const shellTokens = shellQuorum(clusterPerPageInstances);
 * const report = buildPageLandmarkReport(extractLandmarks(page.html), shellTokens);
 * ```
 */
export function buildPageLandmarkReport(
	landmarks: ExtractLandmarksResult,
	shellTokens: ReadonlySet<string>,
	tokenizeOptions?: TokenizeOptions,
): PageLandmarkReport {
	const report: PageLandmarkReport = {
		header: [],
		footer: [],
		nav: [],
		aside: [],
		form: [],
		search: [],
		main: landmarks.main.map(toPosition),
	};

	for (const type of ALL_LANDMARK_TYPES) {
		for (const instance of landmarks[type]) {
			const tokens = instance.html
				? new Set(tokenize(`<body>${instance.html}</body>`, tokenizeOptions).tokens)
				: new Set<string>();
			report[type].push({
				...toPosition(instance),
				isChrome: isChromeLandmarkInstance(tokens, shellTokens),
			});
		}
	}

	return report;
}
