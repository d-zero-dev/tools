export function p(...texts: (string | null | undefined)[]) {
	return texts.filter(Boolean).join('\n\n');
}

export function br(...texts: (string | null | undefined)[]) {
	return texts.filter(Boolean).join('\n');
}
