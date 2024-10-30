export function detectLevel(tags: readonly string[]) {
	return tags.includes('wcag2')
		? 'A'
		: tags.includes('wcag21')
			? 'AA'
			: tags.includes('wcag2aaa')
				? 'AAA'
				: null;
}
