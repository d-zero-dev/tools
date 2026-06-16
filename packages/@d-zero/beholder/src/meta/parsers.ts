/**
 * Value normalizers used by `classify()` to turn raw `content` strings into
 * structured objects (viewport, robots, format-detection, etc.).
 *
 * Each parser is a pure function that takes the raw `content` string and
 * returns a normalized structure. They never throw; on unrecognizable input
 * they fall back to keeping the `raw` field only.
 * @module
 */

import type { KeyTransform } from './keys.js';
import type {
	FormatDetectionMeta,
	HttpEquivRefresh,
	JsonLdEntry,
	ReferrerMeta,
	RobotsMeta,
	ViewportMeta,
} from './types.js';

/**
 * Parses `<meta name="viewport">` content into a structured `ViewportMeta`.
 * @param raw
 * @example parseViewport('width=device-width, initial-scale=1.0')
 *   → { raw: '...', width: 'device-width', initialScale: 1 }
 */
export function parseViewport(raw: string): ViewportMeta {
	const meta: ViewportMeta = { raw };
	for (const part of raw.split(',')) {
		const split = part.split('=');
		const keyRaw = split[0] ?? '';
		const valueRaw = split[1] ?? '';
		const key = keyRaw.trim().toLowerCase();
		const value = valueRaw.trim();
		if (!key) continue;
		switch (key) {
			case 'width': {
				meta.width = value;
				break;
			}
			case 'height': {
				meta.height = value;
				break;
			}
			case 'initial-scale': {
				const n = Number.parseFloat(value);
				if (!Number.isNaN(n)) meta.initialScale = n;
				break;
			}
			case 'minimum-scale': {
				const n = Number.parseFloat(value);
				if (!Number.isNaN(n)) meta.minimumScale = n;
				break;
			}
			case 'maximum-scale': {
				const n = Number.parseFloat(value);
				if (!Number.isNaN(n)) meta.maximumScale = n;
				break;
			}
			case 'user-scalable': {
				const lower = value.toLowerCase();
				if (lower === 'no' || lower === '0') meta.userScalable = false;
				else if (lower === 'yes' || lower === '1') meta.userScalable = true;
				else meta.userScalable = value;
				break;
			}
			case 'viewport-fit': {
				meta.viewportFit = value;
				break;
			}
			case 'interactive-widget': {
				meta.interactiveWidget = value;
				break;
			}
		}
	}
	return meta;
}

const ROBOTS_BOOLEAN_FLAGS = new Set<keyof RobotsMeta>([
	'index',
	'noindex',
	'follow',
	'nofollow',
	'none',
	'all',
	'noarchive',
	'nosnippet',
	'noimageindex',
	'nocache',
	'notranslate',
	'noodp',
	'noydir',
	'indexifembedded',
]);

/**
 * Parses `<meta name="robots">` content into a structured `RobotsMeta`.
 * @param raw
 * @example parseRobots('noindex, max-snippet:50, unavailable_after:2026-01-01')
 *   → { raw: '...', noindex: true, maxSnippet: 50, unavailableAfter: '2026-01-01' }
 */
export function parseRobots(raw: string): RobotsMeta {
	const meta: RobotsMeta = { raw };
	for (const token of raw.split(',')) {
		const trimmed = token.trim().toLowerCase();
		if (!trimmed) continue;

		if (ROBOTS_BOOLEAN_FLAGS.has(trimmed as keyof RobotsMeta)) {
			(meta as Record<string, unknown>)[trimmed] = true;
			continue;
		}

		const colonIndex = trimmed.indexOf(':');
		if (colonIndex === -1) {
			continue;
		}
		const key = trimmed.slice(0, colonIndex).trim();
		const value = token.slice(token.indexOf(':') + 1).trim();
		switch (key) {
			case 'max-snippet': {
				const n = Number.parseInt(value, 10);
				if (!Number.isNaN(n)) meta.maxSnippet = n;
				break;
			}
			case 'max-image-preview': {
				meta.maxImagePreview = value;
				break;
			}
			case 'max-video-preview': {
				const n = Number.parseInt(value, 10);
				if (!Number.isNaN(n)) meta.maxVideoPreview = n;
				break;
			}
			case 'unavailable_after':
			case 'unavailable-after': {
				meta.unavailableAfter = value;
				break;
			}
		}
	}
	return meta;
}

const REFERRER_POLICY_KEYS: Record<string, keyof ReferrerMeta> = {
	'no-referrer': 'noReferrer',
	origin: 'origin',
	'origin-when-cross-origin': 'originWhenCrossOrigin',
	'strict-origin': 'strictOrigin',
	'strict-origin-when-cross-origin': 'strictOriginWhenCrossOrigin',
	'unsafe-url': 'unsafeUrl',
	'same-origin': 'sameOrigin',
	'no-referrer-when-downgrade': 'noReferrerWhenDowngrade',
};

/**
 * Parses `<meta name="referrer">` content into a structured `ReferrerMeta`.
 * @param raw
 */
export function parseReferrer(raw: string): ReferrerMeta {
	const meta: ReferrerMeta = { raw };
	const key = REFERRER_POLICY_KEYS[raw.trim().toLowerCase()];
	if (key) {
		(meta as Record<string, unknown>)[key] = true;
	}
	return meta;
}

/**
 * Parses `<meta name="format-detection">` content (e.g. `'telephone=no, address=no'`).
 * @param raw
 */
export function parseFormatDetection(raw: string): FormatDetectionMeta {
	const meta: FormatDetectionMeta = { raw };
	for (const part of raw.split(/[,;]/)) {
		const split = part.split('=');
		const keyRaw = split[0] ?? '';
		const valueRaw = split[1] ?? '';
		const key = keyRaw.trim().toLowerCase();
		const value = valueRaw.trim().toLowerCase();
		if (!key) continue;
		const enabled = value !== 'no' && value !== 'false' && value !== '0';
		switch (key) {
			case 'telephone': {
				meta.telephone = enabled;
				break;
			}
			case 'email': {
				meta.email = enabled;
				break;
			}
			case 'address': {
				meta.address = enabled;
				break;
			}
			case 'date': {
				meta.date = enabled;
				break;
			}
		}
	}
	return meta;
}

/**
 * Parses `<meta http-equiv="refresh">` content (e.g. `'5; url=https://...'`).
 * @param raw
 */
export function parseRefresh(raw: string): HttpEquivRefresh {
	const refresh: HttpEquivRefresh = { raw };
	const split = raw.split(';');
	const secondsRaw = split[0] ?? '';
	const rest = split.slice(1).join(';');
	const seconds = Number.parseFloat(secondsRaw.trim());
	if (!Number.isNaN(seconds)) {
		refresh.seconds = seconds;
	}
	const urlMatch = /url\s*=\s*(.+)/i.exec(rest);
	if (urlMatch?.[1]) {
		refresh.url = urlMatch[1].trim().replaceAll(/^['"]|['"]$/g, '');
	}
	return refresh;
}

/**
 * Parses a `<script type="application/ld+json">` (or speculationrules) body
 * into a {@link JsonLdEntry}. On parse failure, the entry preserves the `raw`
 * text and records the error message in `parseError`.
 * @param content
 */
export function parseJsonLd(content: string): JsonLdEntry {
	const raw = content;
	try {
		const parsed: unknown = JSON.parse(content);
		return { raw, parsed };
	} catch (error) {
		const parseError = error instanceof Error ? error.message : String(error);
		return { raw, parseError };
	}
}

/**
 * Normalizes a string value according to a {@link KeyTransform}.
 *
 * `'boolean-yes'`: `'yes'` → `true`, `'no'` → `false`, anything else → raw string
 * `'boolean-on'`: `'on'`/`'true'`/`'1'` → `true`, `'off'`/`'false'`/`'0'` → `false`, else raw
 * `'boolean-true'`: `'true'` → `true`, `'false'` → `false`, else raw
 * `'number'`: parsed via `Number.parseFloat`, falls back to raw on NaN
 * `'string'` (default): returns the value unchanged
 * @param value
 * @param transform
 */
export function normalizeValue(
	value: string,
	transform: KeyTransform | undefined,
): string | number | boolean {
	if (!transform || transform === 'string') {
		return value;
	}
	const lower = value.trim().toLowerCase();
	switch (transform) {
		case 'boolean-yes': {
			if (lower === 'yes') return true;
			if (lower === 'no') return false;
			return value;
		}
		case 'boolean-on': {
			if (lower === 'on' || lower === 'true' || lower === '1') return true;
			if (lower === 'off' || lower === 'false' || lower === '0') return false;
			return value;
		}
		case 'boolean-true': {
			if (lower === 'true') return true;
			if (lower === 'false') return false;
			return value;
		}
		case 'number': {
			const n = Number.parseFloat(value);
			return Number.isNaN(n) ? value : n;
		}
	}
}

/**
 * JSON-LD / speculationrules content size caps (bytes). Above these sizes the
 * content is truncated and a `truncated` marker is emitted via `parseError`.
 */
export const JSON_LD_PER_ENTRY_LIMIT = 200_000;
export const JSON_LD_TOTAL_LIMIT = 1_000_000;

/**
 * Caps a single JSON-LD entry's raw content to {@link JSON_LD_PER_ENTRY_LIMIT}.
 * Returns the (possibly truncated) entry and a `truncated` flag.
 * @param content
 */
export function capJsonLdContent(content: string): {
	content: string;
	truncated: boolean;
} {
	if (content.length <= JSON_LD_PER_ENTRY_LIMIT) {
		return { content, truncated: false };
	}
	return { content: content.slice(0, JSON_LD_PER_ENTRY_LIMIT), truncated: true };
}
