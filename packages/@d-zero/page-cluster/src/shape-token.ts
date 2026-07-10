/**
 * @param segment
 */
function shapeSegment(segment: string): string {
	const bracketIndex = segment.indexOf('[');
	const bracket = bracketIndex === -1 ? '' : segment.slice(bracketIndex);
	const base = bracketIndex === -1 ? segment : segment.slice(0, bracketIndex);

	let shapedBase: string;
	if (base.startsWith('.')) {
		// Foldable tag (div/span) with classes: .class1.class2 → *
		shapedBase = '*';
	} else {
		const dotIndex = base.indexOf('.');
		if (dotIndex > 0) {
			// Non-foldable tag with classes: tag.class1 → tag
			shapedBase = base.slice(0, dotIndex);
		} else {
			// No classes (tag name only, or empty for bracket-only segments)
			shapedBase = base;
		}
	}

	return `${shapedBase}${bracket}`;
}

/**
 * Stripping classes while keeping the bracket reveals the tag-level (or
 * wrapper-level) shape: `section.c-page-sub__reports` and
 * `section.c-page-sub__projects` both shape to `section`, exposing that they
 * are the same structural element with different BEM class names. Used in
 * cross-block clustering to merge blocks whose class names differ but whose
 * skeletons match (confirmed on real crawl data: reports/projects/news list
 * pages had class-name Jaccard 0.000 and shape Jaccard 1.000).
 * @param token
 */
export function shapeToken(token: string): string {
	return token.split('>').map(shapeSegment).join('>');
}
