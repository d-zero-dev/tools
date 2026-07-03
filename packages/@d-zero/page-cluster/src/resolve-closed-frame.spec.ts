import type { Frame } from './types.js';

import { describe, expect, test } from 'vitest';

import { resolveClosedFrame } from './resolve-closed-frame.js';

/**
 *
 * @param overrides
 */
function frame(overrides: Partial<Frame>): Frame {
	return {
		tagName: 'div',
		segment: 'div',
		isFoldCandidate: false,
		childElementCount: 0,
		pendingPaths: [],
		...overrides,
	};
}

describe('resolveClosedFrame', () => {
	test('a childless element is itself a leaf', () => {
		const result = resolveClosedFrame(
			frame({ segment: '.spacer', childElementCount: 0 }),
		);
		expect(result).toStrictEqual(['.spacer']);
	});

	test('a fold candidate with exactly one child is elided', () => {
		const result = resolveClosedFrame(
			frame({
				segment: 'div',
				isFoldCandidate: true,
				childElementCount: 1,
				pendingPaths: ['ul>li'],
			}),
		);
		expect(result).toStrictEqual(['ul>li']);
	});

	test('a fold candidate with two children is NOT elided', () => {
		const result = resolveClosedFrame(
			frame({
				segment: 'div',
				isFoldCandidate: true,
				childElementCount: 2,
				pendingPaths: ['span', 'span'],
			}),
		);
		expect(result).toStrictEqual(['div>span', 'div>span']);
	});

	test('a non-fold-candidate (e.g. has a class) always prefixes its segment', () => {
		const result = resolveClosedFrame(
			frame({
				segment: '.card',
				isFoldCandidate: false,
				childElementCount: 1,
				pendingPaths: ['ul>li'],
			}),
		);
		expect(result).toStrictEqual(['.card>ul>li']);
	});

	test('duplicate paths are passed through unchanged (no compression)', () => {
		const result = resolveClosedFrame(
			frame({
				segment: 'ul',
				isFoldCandidate: false,
				childElementCount: 3,
				pendingPaths: ['li', 'li', 'li'],
			}),
		);
		expect(result).toStrictEqual(['ul>li', 'ul>li', 'ul>li']);
	});

	test('an element containing only a comment (0 element children) is not treated as a plain leaf', () => {
		const result = resolveClosedFrame(
			frame({
				segment: 'div',
				isFoldCandidate: true,
				childElementCount: 0,
				pendingPaths: ['comment[sha=abcd1234ef567890]'],
			}),
		);
		// Not folded: folding requires exactly one *element* child, and there
		// are none here — only a comment, which never increments
		// childElementCount. The comment must not be silently dropped either.
		expect(result).toStrictEqual(['div>comment[sha=abcd1234ef567890]']);
	});
});
