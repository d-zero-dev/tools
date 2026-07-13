import { describe, expect, test } from 'vitest';

import { assignContainedClusters } from './assign-contained-clusters.js';

describe('assignContainedClusters', () => {
	test('single cluster maps to itself', () => {
		const result = assignContainedClusters([
			{ id: 0, tokens: new Set(['a', 'b', 'c']), pageCount: 3 },
		]);
		expect(result.get(0)).toBe(0);
	});

	test('empty cluster is never assigned (skipped in phase 1)', () => {
		const result = assignContainedClusters([
			{ id: 0, tokens: new Set<string>(), pageCount: 0 },
			{ id: 1, tokens: new Set(['a', 'b']), pageCount: 2 },
		]);
		expect(result.get(0)).toBe(0);
		expect(result.get(1)).toBe(1);
	});

	test('X wholly contained by Y: X → Y, Y → itself', () => {
		const result = assignContainedClusters([
			{ id: 0, tokens: new Set(['a', 'b']), pageCount: 1 },
			{ id: 1, tokens: new Set(['a', 'b', 'c', 'd']), pageCount: 5 },
		]);
		expect(result.get(0)).toBe(1);
		expect(result.get(1)).toBe(1);
	});

	test('assignment is one-directional: Y does not absorb into X', () => {
		// Containment(Y → X) = 2/4 = 0.5 < 0.9 → Y is NOT absorbed by X
		const result = assignContainedClusters([
			{ id: 0, tokens: new Set(['a', 'b']), pageCount: 1 },
			{ id: 1, tokens: new Set(['a', 'b', 'c', 'd']), pageCount: 5 },
		]);
		expect(result.get(1)).toBe(1); // Y is NOT absorbed into X
	});

	test('containment below 0.9 is ignored', () => {
		// 8 tokens shared out of 10 = 0.8 containment < 0.9 → no assignment
		const xTokens = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
		const yTokens = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'x', 'y']);
		const result = assignContainedClusters([
			{ id: 0, tokens: xTokens, pageCount: 1 },
			{ id: 1, tokens: yTokens, pageCount: 5 },
		]);
		expect(result.get(0)).toBe(0);
		expect(result.get(1)).toBe(1);
	});

	test('hub pattern: X and Z both absorbed by hub, but not merged with each other', () => {
		// Hub has all tokens; X ⊂ Hub, Z ⊂ Hub, but X and Z are disjoint
		const result = assignContainedClusters([
			{ id: 0, tokens: new Set(['a', 'b']), pageCount: 1 },
			{ id: 1, tokens: new Set(['a', 'b', 'c', 'd']), pageCount: 5 },
			{ id: 2, tokens: new Set(['c', 'd']), pageCount: 1 },
		]);
		expect(result.get(0)).toBe(1); // X → hub
		expect(result.get(2)).toBe(1); // Z → hub
		expect(result.get(1)).toBe(1); // hub → itself
		// X and Z map to the same hub but are not connected to each other
	});

	test('chain A → B → C: all resolve to C', () => {
		// A ⊂ B ⊂ C
		const result = assignContainedClusters([
			{ id: 0, tokens: new Set(['a']), pageCount: 1 },
			{ id: 1, tokens: new Set(['a', 'b']), pageCount: 2 },
			{ id: 2, tokens: new Set(['a', 'b', 'c', 'd']), pageCount: 3 },
		]);
		expect(result.get(0)).toBe(2);
		expect(result.get(1)).toBe(2);
		expect(result.get(2)).toBe(2);
	});

	test('cycle: mutual containment ≥ 0.9 → larger token set is root', () => {
		// A containment in B = 10/10 = 1.0 → A → B
		// B containment in A = 10/11 ≈ 0.909 → B → A
		// Cycle detected; B has more tokens → B is root
		const aTokens = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
		const bTokens = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']);
		const result = assignContainedClusters([
			{ id: 0, tokens: aTokens, pageCount: 1 },
			{ id: 1, tokens: bTokens, pageCount: 1 },
		]);
		expect(result.get(0)).toBe(1);
		expect(result.get(1)).toBe(1);
	});

	test('cycle tie-break uses pageCount when token sizes are equal', () => {
		// Both share 9/10 tokens each → containment 0.9 → mutual assignment → cycle
		// A has 10 tokens, B has 10 tokens (equal); B has more pages → B wins
		const sharedTokens = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
		const aTokens = new Set([...sharedTokens, 'unique-a']);
		const bTokens = new Set([...sharedTokens, 'unique-b']);
		const result = assignContainedClusters([
			{ id: 0, tokens: aTokens, pageCount: 1 },
			{ id: 1, tokens: bTokens, pageCount: 5 },
		]);
		// Both have 10 tokens; B has more pages → B is root
		expect(result.get(0)).toBe(1);
		expect(result.get(1)).toBe(1);
	});

	test('every id has an entry in the result map', () => {
		const result = assignContainedClusters([
			{ id: 0, tokens: new Set(['a']), pageCount: 1 },
			{ id: 1, tokens: new Set(['b']), pageCount: 1 },
			{ id: 2, tokens: new Set(['c']), pageCount: 1 },
		]);
		expect(result.has(0)).toBe(true);
		expect(result.has(1)).toBe(true);
		expect(result.has(2)).toBe(true);
	});
});
