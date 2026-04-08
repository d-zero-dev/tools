import { expect, it } from 'vitest';

import { urlPartialMatch } from './url-partial-match.js';

it('matches', () => {
	expect(
		urlPartialMatch(
			'https://lineit.line.me/share/ui?url=https%3A%2F%2Fwww.example.com',
			'https://lineit.line.me/share/ui',
		),
	).toBe(true);
	expect(
		urlPartialMatch(
			'https://twitter.com/share?url=https%3A%2F%2Fwww.example.com',
			'https://twitter.com/share',
		),
	).toBe(true);
	expect(
		urlPartialMatch(
			'https://www.facebook.com/share.php?u=https%3A%2F%2Fwww.example.com',
			'https://www.facebook.com/share.php',
		),
	).toBe(true);
	expect(
		urlPartialMatch(
			'https://plus.google.com/share?url=https%3A%2F%2Fwww.example.com',
			'https://plus.google.com/share',
		),
	).toBe(true);
});
