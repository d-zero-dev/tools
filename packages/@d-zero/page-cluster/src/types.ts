/**
 * Identity of a page's content-root element — the element whose subtree
 * holds the page-specific content and under which
 * {@link ./cap-content-depth.js | capContentDepth} counts nesting depth.
 *
 * Every field that is given must match the same element. Empty strings and
 * empty arrays count as "not given", and a root with no constraint at all
 * matches nothing (otherwise the shallowest element of the page would win
 * and the cap would silently apply to the wrong node).
 *
 * A structured object rather than a CSS selector string: nothing has to be
 * parsed (the HTML parser already exposes `id`/`class`/`role`), it maps 1:1
 * onto the columns a crawler records for its detected main-content element,
 * and a crawler's own selector string is diagnostic (tag + id + classes) and
 * not guaranteed to be unique, so it is the wrong thing to re-parse.
 */
export type ContentRoot = {
	/** Case-insensitive: a crawler reading `Element.nodeName` reports `'DIV'`, the HTML parser reports `'div'`. */
	readonly tagName?: string;
	readonly id?: string;
	readonly role?: string;
	/** Every listed class must be present on the element (subset match; order does not matter). */
	readonly classList?: readonly string[];
};

/**
 * Result of {@link ../tokenize.js | tokenize}. `bodyClassList` is kept
 * separate from `tokens` rather than folded into the root of every leaf
 * path: CMS `body_class()` conventions (WordPress, Drupal, ...) commonly
 * inject a per-page-category label onto `<body>` (e.g. `law-page`,
 * `humanities-page`), and a caller that mixed it into every path would find
 * that a single such label corrupts *every* token for that page, since it's
 * the common prefix of every root-to-leaf path — collapsing near-duplicate
 * pages to zero similarity even when their descendant structure is
 * otherwise identical. Moving it out preserves the information (a caller
 * that genuinely needs body-class-driven grouping still has it) without
 * letting it poison structural comparison by default.
 */
export type TokenizeResult = {
	tokens: string[];
	bodyClassList: string[];
	/**
	 * Every class name that ended up in some segment of `tokens` (i.e. on an
	 * element below `<body>`, after noise filtering and `allowedClasses`),
	 * deduplicated, in first-seen document order. `<body>`'s own classes are
	 * not included — they live in `bodyClassList`. Classes on an opaque
	 * element (`script`/`style`/`noscript`/`svg`) or anything inside one are
	 * not included either, since those elements are hashed as a whole and
	 * their classes never reach a segment.
	 *
	 * Exposed so a caller comparing many pages can compute per-class document
	 * frequency without parsing class names back out of `tokens` — which is
	 * not reliably possible, since a class name may itself contain the `.`,
	 * `>` and `[` characters the token grammar uses as delimiters (Tailwind
	 * arbitrary values such as `w-[1.5rem]`, for instance).
	 */
	classList: string[];
};

/**
 * Options for {@link ../tokenize.js | tokenize}.
 */
export type TokenizeOptions = {
	/** Exclude hash-like auto-generated class names (CSS Modules, styled-components, emotion, bundler content-hash suffixes) before building segments. Defaults to `true`. */
	filterNoiseClasses?: boolean;
	/** Emit `comment[sha=...]` tokens for HTML comment nodes. Defaults to `false`. */
	includeComments?: boolean;
	/**
	 * When set, only class names contained in this set are kept when building
	 * segments; every other class is treated exactly as if it were absent from
	 * the element's `class` attribute — so a `div`/`span` whose classes are all
	 * dropped becomes an anonymous wrapper again and folds away under the
	 * usual single-child rule. Applied after `filterNoiseClasses`. Does not
	 * affect `bodyClassList`, which is only subject to `filterNoiseClasses`.
	 * `undefined` (the default) keeps every class.
	 */
	allowedClasses?: ReadonlySet<string>;
};

/**
 * `TokenizeOptions` with every field defaulted.
 */
export type ResolvedOptions = {
	filterNoiseClasses: boolean;
	includeComments: boolean;
	allowedClasses: ReadonlySet<string> | undefined;
};

/**
 * One entry in the currently-open ancestor chain.
 *
 * Descendant leaf paths are accumulated in `pendingPaths` *relative to this
 * frame* (i.e. without this frame's own `segment` prefixed yet), because
 * whether this frame folds away or keeps its segment is only known once it
 * closes (see `resolve-closed-frame.ts`). Holding one frame per open ancestor
 * — rather than the whole parsed document — keeps memory proportional to
 * nesting depth, not document size.
 */
export type Frame = {
	tagName: string;
	/** This element's own path segment (class/role/type already applied). */
	segment: string;
	/** The class names `segment` was built from (already noise-filtered and `allowedClasses`-filtered). */
	classList: readonly string[];
	/** Whether this is a class-less/role-less/type-less `div` or `span`, eligible to be elided when it has exactly one element child. */
	isFoldCandidate: boolean;
	/** Count of direct element children (text and comment nodes are not counted). */
	childElementCount: number;
	/** Finalized descendant leaf paths, relative to this frame, in document order. */
	pendingPaths: string[];
};

/**
 * Result of {@link ../compute-document-frequency.js | computeDocumentFrequency}: how many pages (out of `pageCount`) contain each token.
 *
 * `pageCount` travels bundled with `documentFrequency` rather than being a
 * separate argument at call sites that consume it (e.g.
 * `splitTokensByFrequency`), so the two can never be passed out of sync with
 * each other (e.g. a caller re-slicing the page list after computing
 * frequencies but before using them).
 */
export type DocumentFrequency = {
	documentFrequency: ReadonlyMap<string, number>;
	pageCount: number;
};

/**
 * Tags whose contents are hashed instead of being tokenized further.
 */
export type OpaqueTagName = 'script' | 'style' | 'noscript' | 'svg';

/**
 * Tracks an open `script`/`style`/`noscript`/`svg` region so its raw source
 * can be sliced out once it closes. `depth` guards against self-nesting
 * (`<svg><svg>...`) closing the region prematurely.
 */
export type OpaqueRegion = {
	tagName: OpaqueTagName;
	depth: number;
	/** Offset into the original HTML string, just after the opening tag's `>`. */
	contentStart: number;
	/** `role`/`type` of the *outermost* opaque tag, captured when it opens (e.g. `<svg role="img">`). */
	role: string | undefined;
	type: string | undefined;
};
