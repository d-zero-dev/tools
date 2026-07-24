/**
 * The evidence behind one Pass-0 blocking key — which signal
 * {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys} (and,
 * for the `orphanMerge` variant, {@link ./reassign-orphan-block-keys.js |
 * reassignOrphanBlockKeys}) actually used to decide it, carried verbatim with
 * no added interpretation. Every page sharing a `css:<hash>` blocking key
 * shares the exact same `distinctiveStylesheetHrefs` set by construction (the
 * hash is derived from that set), so one `BlockingReason` per distinct
 * blocking key is enough — it does not need to vary per page.
 */
export type BlockingReason =
	| {
			readonly kind: 'css';
			/**
			 * The sorted, deduplicated, first-party stylesheet hrefs left after
			 * corpus-wide chrome removal — the exact set
			 * {@link ./derive-stylesheet-group-key.js | deriveStylesheetGroupKey}
			 * hashed into this blocking key.
			 */
			readonly distinctiveStylesheetHrefs: readonly string[];
	  }
	| {
			readonly kind: 'path';
			/** The `derivePathGroupKey` result this blocking key was derived from. */
			readonly pathKey: string;
	  }
	| {
			readonly kind: 'orphanMerge';
			/**
			 * The confined `path:` key this stylesheet-less page was folded into a
			 * same-section `css:` block under — see
			 * {@link ./reassign-orphan-block-keys.js | reassignOrphanBlockKeys}.
			 */
			readonly pathKey: string;
	  };
