import { toListWithPosition } from './to-list-with-position.js';

/**
 *
 * @param text
 */
export function toList(text: string) {
	return toListWithPosition(text).map((item) => item.value);
}
