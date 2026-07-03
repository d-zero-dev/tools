/**
 * Options for {@link ../tokenize.js | tokenize}.
 */
export type TokenizeOptions = {
	/** Exclude hash-like auto-generated class names (CSS Modules, styled-components, emotion, bundler content-hash suffixes) before building segments. Defaults to `true`. */
	filterNoiseClasses?: boolean;
	/** Emit `comment[sha=...]` tokens for HTML comment nodes. Defaults to `false`. */
	includeComments?: boolean;
};

/**
 * `TokenizeOptions` with every field defaulted.
 */
export type ResolvedOptions = {
	filterNoiseClasses: boolean;
	includeComments: boolean;
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
	/** Whether this is a class-less/role-less/type-less `div` or `span`, eligible to be elided when it has exactly one element child. */
	isFoldCandidate: boolean;
	/** Count of direct element children (text and comment nodes are not counted). */
	childElementCount: number;
	/** Finalized descendant leaf paths, relative to this frame, in document order. */
	pendingPaths: string[];
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
