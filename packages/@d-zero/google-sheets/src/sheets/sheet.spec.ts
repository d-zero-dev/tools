import { describe, test, expect, vi } from 'vitest';

import { Sheet } from './sheet.js';

/**
 *
 * @param rowMetadata
 */
function createMockParent(rowMetadata: Record<string, unknown>[]) {
	return {
		getWithGridData: vi.fn().mockResolvedValue({
			data: {
				sheets: [
					{
						data: [
							{
								rowMetadata,
							},
						],
					},
				],
			},
		}),
	};
}

describe('getRowMetadata', () => {
	const mockSheet = {
		properties: { title: 'TestSheet', sheetId: 0 },
	};

	test('returns hiddenByUser: true for user-hidden rows', async () => {
		const parent = createMockParent([{ hiddenByUser: true }, { hiddenByUser: false }]);
		const sheet = new Sheet(mockSheet as never, parent as never);

		const result = await sheet.getRowMetadata(2);

		expect(result).toEqual([
			{ hiddenByUser: true, hiddenByFilter: false },
			{ hiddenByUser: false, hiddenByFilter: false },
		]);
	});

	test('returns hiddenByFilter: true for filter-hidden rows', async () => {
		const parent = createMockParent([
			{ hiddenByFilter: true },
			{ hiddenByFilter: false },
		]);
		const sheet = new Sheet(mockSheet as never, parent as never);

		const result = await sheet.getRowMetadata(2);

		expect(result).toEqual([
			{ hiddenByUser: false, hiddenByFilter: true },
			{ hiddenByUser: false, hiddenByFilter: false },
		]);
	});

	test('returns both true when hidden by user and filter', async () => {
		const parent = createMockParent([{ hiddenByUser: true, hiddenByFilter: true }]);
		const sheet = new Sheet(mockSheet as never, parent as never);

		const result = await sheet.getRowMetadata(2);

		expect(result).toEqual([{ hiddenByUser: true, hiddenByFilter: true }]);
	});

	test('returns both false for visible rows', async () => {
		const parent = createMockParent([{}]);
		const sheet = new Sheet(mockSheet as never, parent as never);

		const result = await sheet.getRowMetadata(2);

		expect(result).toEqual([{ hiddenByUser: false, hiddenByFilter: false }]);
	});

	test('returns empty array when rowMetadata is empty', async () => {
		const parent = createMockParent([]);
		const sheet = new Sheet(mockSheet as never, parent as never);

		const result = await sheet.getRowMetadata(2);

		expect(result).toEqual([]);
	});

	test('returns empty array when API returns no sheets data', async () => {
		const parent = {
			getWithGridData: vi.fn().mockResolvedValue({
				data: { sheets: [] },
			}),
		};
		const sheet = new Sheet(mockSheet as never, parent as never);

		const result = await sheet.getRowMetadata(2);

		expect(result).toEqual([]);
	});

	test('passes correct range to getWithGridData', async () => {
		const parent = createMockParent([]);
		const sheet = new Sheet(mockSheet as never, parent as never);

		await sheet.getRowMetadata(3);

		expect(parent.getWithGridData).toHaveBeenCalledWith("'TestSheet'!A3:A");
	});
});
