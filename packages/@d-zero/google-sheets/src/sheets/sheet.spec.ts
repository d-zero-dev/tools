import { describe, test, expect, vi } from 'vitest';

import { Cell } from './cell.js';
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

describe('addRowData memory guards', () => {
	const mockSheet = {
		properties: { title: 'TestSheet', sheetId: 0 },
	};

	test('does not JSON.stringify the cell payload when the debug log is disabled', async () => {
		// The sendLog.enabled guard at sheet.ts:#addRowData prevents an
		// expensive `JSON.stringify(sendData)` for byte-length reporting
		// when DEBUG is off. Without that guard, a 30k-row send would
		// allocate a multi-MB string per chunk on every call — the OOM
		// path observed in nitpicker's report-google-sheets pipeline.
		const parent = {
			batchUpdate: vi.fn().mockResolvedValue({}),
		};
		const sheet = new Sheet(mockSheet as never, parent as never);
		const rows = [
			[new Cell({ value: 'a' }), new Cell({ value: 'b' })],
			[new Cell({ value: 'c' }), new Cell({ value: 'd' })],
		];

		// Spy on JSON.stringify and confirm it is not called with our
		// sendData payload (an array of `{values: [...]}` objects).
		const stringifySpy = vi.spyOn(JSON, 'stringify');
		await sheet.addRowData(rows, false);

		const calledOnSendData = stringifySpy.mock.calls.some(([arg]) => {
			if (!Array.isArray(arg) || arg.length === 0) return false;
			const first = arg[0] as Record<string, unknown>;
			return typeof first === 'object' && first !== null && 'values' in first;
		});
		expect(calledOnSendData).toBe(false);

		stringifySpy.mockRestore();
	});

	test('still sends the cell payload to batchUpdate via updateCells', async () => {
		// Guard regression check: removing the JSON.stringify call must not
		// also remove the actual batchUpdate(updateCells) request.
		const parent = {
			batchUpdate: vi.fn().mockResolvedValue({}),
		};
		const sheet = new Sheet(mockSheet as never, parent as never);
		const rows = [[new Cell({ value: 'hello' })]];

		await sheet.addRowData(rows, false);

		const updateCellsCalls = parent.batchUpdate.mock.calls.filter(
			([req]: [Record<string, unknown>]) => 'updateCells' in req,
		);
		expect(updateCellsCalls).toHaveLength(1);
	});
});
