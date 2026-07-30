import type { ViewportSpec } from './types.js';

/**
 * Parses a `--viewport name:width` CLI value. Height is intentionally not
 * part of this syntax: `beforePageScan` (from `@d-zero/puppeteer-page-scan`)
 * derives height from width itself (`width * 0.75` above 1000px, `* 1.5`
 * at or below), so there is no independent height to accept here.
 * @param spec - A `"name:width"` string, e.g. `"pc:1280"`.
 * @throws {Error} When `spec` isn't of the form `"name:width"` with a
 *   positive numeric width.
 * @example
 * ```ts
 * parseViewportSpec('pc:1280'); // { name: 'pc', width: 1280 }
 * ```
 */
export function parseViewportSpec(spec: string): ViewportSpec {
	const separatorIndex = spec.indexOf(':');
	if (separatorIndex === -1) {
		throw new Error(`invalid viewport spec "${spec}": expected "name:width"`);
	}

	const name = spec.slice(0, separatorIndex);
	const widthText = spec.slice(separatorIndex + 1);
	if (name.length === 0) {
		throw new Error(`invalid viewport spec "${spec}": name must not be empty`);
	}

	const width = Number(widthText);
	if (!Number.isFinite(width) || width <= 0) {
		throw new Error(`invalid viewport spec "${spec}": width must be a positive number`);
	}

	return { name, width };
}
