export function detectLevel(tags: readonly string[]) {
	return tags.includes('wcag2a')
		? 'A'
		: tags.includes('wcag2aa')
			? 'AA'
			: tags.includes('wcag2aaa')
				? 'AAA'
				: null;
}
