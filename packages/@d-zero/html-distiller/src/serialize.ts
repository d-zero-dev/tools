import type { Document } from './types.js';

import { walk } from './walk.js';

/**
 *
 * @param document
 */
export function serialize(document: Document) {
	return document.childNodes.map((childNode) => walk(childNode)).filter(Boolean);
}
