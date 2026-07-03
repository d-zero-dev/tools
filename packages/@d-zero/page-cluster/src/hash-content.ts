import { hash } from '@d-zero/shared/hash';

import { normalizeForHash } from './normalize-for-hash.js';

/**
 * 16 hex characters (8 bytes) of SHA-256. Full 64-character digests would
 * make tokens unwieldy for no practical benefit here: this hash only needs
 * to answer "did this script/style/svg/comment's content change", not
 * resist deliberate collision attacks, so the reduced collision resistance
 * of a truncated digest is an acceptable trade-off.
 *
 * Exported so other hashed-key producers in this package (e.g.
 * `deriveStylesheetGroupKey`) use the same truncation length instead of
 * picking their own.
 */
export const HASH_LENGTH = 16;

/**
 * Hashes `script`/`style`/`svg`/`noscript`/comment content instead of
 * tokenizing it. The raw content is never retained in the output: keeping it
 * verbatim would bloat tokens with implementation detail (JS/CSS source,
 * SVG path data) that carries no structural signal for duplicate-page
 * detection, and could leak sensitive inline content collected from crawled
 * pages.
 * @param raw
 */
export function hashContent(raw: string): string {
	return hash(normalizeForHash(raw)).slice(0, HASH_LENGTH);
}
