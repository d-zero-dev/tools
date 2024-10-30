import { wcag } from '@d-zero/db-wcag';

const scVersions = new Set<keyof (typeof wcag.successCriterions)['wcag_2.2']['en']>(
	// @ts-ignore
	Object.keys(wcag.successCriterions['wcag_2.2'].en),
);

export function tagsToSCs(tags: string[]) {
	return tags.map(tagToSC).filter(Boolean).join('\n');
}

export function tagToSC(tag: string) {
	if (!tag.startsWith('wcag') || tag.endsWith('a')) {
		return null;
	}

	const num = /\d+/.exec(tag)?.[0];

	if (!num) {
		return null;
	}

	for (const version of scVersions) {
		const crushedNum = version.replaceAll('.', '');

		if (num === crushedNum) {
			return version;
		}
	}

	return null;
}
