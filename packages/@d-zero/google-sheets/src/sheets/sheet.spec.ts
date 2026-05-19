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

describe('appendRow / flush', () => {
	const mockSheet = {
		properties: { title: 'TestSheet', sheetId: 0 },
	};

	/**
	 * Builds a stub Sheets parent whose `batchUpdate` records every
	 * `updateCells` request so tests can inspect the per-flush row counts.
	 * `appendDimension` requests (from `#expandGrid`) are ignored.
	 */
	function createRecordingParent() {
		const updateCellsRows: number[] = [];
		const parent = {
			batchUpdate: vi.fn((req: Record<string, unknown>) => {
				const updateCells = req.updateCells as
					| { rows?: { values?: unknown[] }[] }
					| undefined;
				if (updateCells?.rows) {
					updateCellsRows.push(updateCells.rows.length);
				}
				return Promise.resolve({});
			}),
		};
		return { parent, updateCellsRows };
	}

	/**
	 * Builds an eager `Row` of `n` cells. The cells share `Cell.prototype.provide`
	 * so `containsLazyCell()` returns false for the row.
	 * @param n Cell count.
	 */
	function eagerRow(n = 1): Cell[] {
		return Array.from({ length: n }, (_, i) => new Cell({ value: `c${i}` }));
	}

	/**
	 * Builds a `Row` whose first cell overrides `provide()`, so the row
	 * trips `containsLazyCell()` — the same shape that
	 * `createCellData(() => ...)` produces in `@d-zero/google-sheets`.
	 */
	function lazyRow(): Cell[] {
		const cell = new Cell({ value: 'placeholder' });
		(cell as unknown as { provide: () => unknown }).provide = () => ({
			userEnteredValue: { stringValue: 'lazy-resolved' },
		});
		return [cell];
	}

	test('holds rows in the buffer until the chunk threshold (2500) is reached', async () => {
		const { parent, updateCellsRows } = createRecordingParent();
		const sheet = new Sheet(mockSheet as never, parent as never);

		// 2499 rows must not trigger a send.
		await sheet.appendRow(...Array.from({ length: 2499 }, () => eagerRow()));
		expect(updateCellsRows).toEqual([]);
		expect(sheet.sentCount).toBe(0);
	});

	test('auto-flushes one chunk of 2500 rows once the buffer hits the threshold', async () => {
		const { parent, updateCellsRows } = createRecordingParent();
		const sheet = new Sheet(mockSheet as never, parent as never);

		await sheet.appendRow(...Array.from({ length: 2500 }, () => eagerRow()));
		expect(updateCellsRows).toEqual([2500]);
		expect(sheet.sentCount).toBe(2500);
	});

	test('auto-flushes multiple chunks within a single appendRow call', async () => {
		const { parent, updateCellsRows } = createRecordingParent();
		const sheet = new Sheet(mockSheet as never, parent as never);

		// 6000 rows in one call → two full chunks of 2500 plus 1000 left buffered.
		await sheet.appendRow(...Array.from({ length: 6000 }, () => eagerRow()));
		expect(updateCellsRows).toEqual([2500, 2500]);
		expect(sheet.sentCount).toBe(5000);
	});

	test('flush() drains the buffer in chunks of at most 2500 rows', async () => {
		const { parent, updateCellsRows } = createRecordingParent();
		const sheet = new Sheet(mockSheet as never, parent as never);

		await sheet.appendRow(...Array.from({ length: 6000 }, () => eagerRow()));
		await sheet.flush();
		expect(updateCellsRows).toEqual([2500, 2500, 1000]);
		expect(sheet.sentCount).toBe(6000);
	});

	test('flush() is a no-op when the buffer is empty', async () => {
		const { parent, updateCellsRows } = createRecordingParent();
		const sheet = new Sheet(mockSheet as never, parent as never);

		await sheet.flush();
		expect(updateCellsRows).toEqual([]);
		expect(sheet.sentCount).toBe(0);
	});

	test('suspends auto-flush as soon as a lazy row enters the buffer', async () => {
		const { parent, updateCellsRows } = createRecordingParent();
		const sheet = new Sheet(mockSheet as never, parent as never);

		// 2499 eager + 1 lazy + 5000 more eager = 7500 rows total.
		// Without lazy, this would trigger 3 auto-flushes (2500 * 3). With
		// lazy, all 7500 must be held until explicit flush.
		await sheet.appendRow(...Array.from({ length: 2499 }, () => eagerRow()));
		await sheet.appendRow(lazyRow());
		await sheet.appendRow(...Array.from({ length: 5000 }, () => eagerRow()));
		expect(updateCellsRows).toEqual([]);
		expect(sheet.sentCount).toBe(0);

		// Explicit flush drains everything in chunks of 2500.
		await sheet.flush();
		expect(updateCellsRows).toEqual([2500, 2500, 2500]);
		expect(sheet.sentCount).toBe(7500);
	});

	test('keeps eager rows held even if they arrive after the lazy row (FIFO preserved)', async () => {
		const { parent, updateCellsRows } = createRecordingParent();
		const sheet = new Sheet(mockSheet as never, parent as never);

		// One lazy then 4999 eager. Without lazy, 5000 eager would split as
		// [2500, 2500]. The lazy row must force the eager tail to wait so
		// the spreadsheet row order matches insertion order.
		await sheet.appendRow(lazyRow());
		await sheet.appendRow(...Array.from({ length: 4999 }, () => eagerRow()));
		expect(updateCellsRows).toEqual([]);

		await sheet.flush();
		expect(updateCellsRows).toEqual([2500, 2500]);
		expect(sheet.sentCount).toBe(5000);
	});

	test('resets the lazy-row latch after flush() so streaming resumes for the next round', async () => {
		const { parent, updateCellsRows } = createRecordingParent();
		const sheet = new Sheet(mockSheet as never, parent as never);

		// Round 1: lazy row triggers buffering; flush sends.
		await sheet.appendRow(lazyRow());
		await sheet.flush();
		const roundOneCalls = [...updateCellsRows];
		expect(roundOneCalls).toEqual([1]);

		// Round 2: all eager — auto-flush must resume at 2500 boundary.
		await sheet.appendRow(...Array.from({ length: 2500 }, () => eagerRow()));
		expect(updateCellsRows.slice(roundOneCalls.length)).toEqual([2500]);
		expect(sheet.sentCount).toBe(2501);
	});

	test('accepts zero rows as a valid no-op call', async () => {
		const { parent, updateCellsRows } = createRecordingParent();
		const sheet = new Sheet(mockSheet as never, parent as never);

		await sheet.appendRow();
		expect(updateCellsRows).toEqual([]);
		expect(sheet.sentCount).toBe(0);
	});

	test('detects a lazy cell at any column position, not just the first cell of the row', async () => {
		// containsLazyCell() iterates every cell of the row. A defensive
		// "optimization" that only checks row[0] would slip past unit tests
		// that always put the lazy cell at index 0 (as the other tests do
		// via lazyRow()). This test puts the lazy cell at the tail so the
		// detection's for-loop is exercised in full.
		const { parent, updateCellsRows } = createRecordingParent();
		const sheet = new Sheet(mockSheet as never, parent as never);

		const tailLazyCell = new Cell({ value: 'tail' });
		(tailLazyCell as unknown as { provide: () => unknown }).provide = () => ({
			userEnteredValue: { stringValue: 'lazy-resolved' },
		});
		const mixedRow: Cell[] = [
			new Cell({ value: 'a' }),
			new Cell({ value: 'b' }),
			new Cell({ value: 'c' }),
			tailLazyCell,
		];

		// 2499 eager rows + 1 mixed row = 2500 rows total. With lazy correctly
		// detected anywhere in the row, auto-flush stays suspended.
		await sheet.appendRow(...Array.from({ length: 2499 }, () => eagerRow()));
		await sheet.appendRow(mixedRow);
		expect(updateCellsRows).toEqual([]);
		expect(sheet.sentCount).toBe(0);

		await sheet.flush();
		expect(updateCellsRows).toEqual([2500]);
		expect(sheet.sentCount).toBe(2500);
	});

	test('forwards an empty row as a single buffered entry', async () => {
		// A row with zero cells is not "lazy" (containsLazyCell of an empty
		// row returns false) and is not skipped — it is queued like any
		// other row and emitted to Sheets on the next flush. This pins down
		// the boundary behavior so a future "skip empty row" optimization
		// would surface as a failing test.
		const { parent, updateCellsRows } = createRecordingParent();
		const sheet = new Sheet(mockSheet as never, parent as never);

		await sheet.appendRow([]);
		await sheet.flush();
		expect(updateCellsRows).toEqual([1]);
		expect(sheet.sentCount).toBe(1);
	});

	test('flush() is idempotent — calling it twice in a row sends nothing extra', async () => {
		// flush() leaves the buffer empty, so a second call must not produce
		// another batchUpdate request. Catches a future regression where
		// state is not properly cleared between flushes.
		const { parent, updateCellsRows } = createRecordingParent();
		const sheet = new Sheet(mockSheet as never, parent as never);

		await sheet.appendRow(...Array.from({ length: 100 }, () => eagerRow()));
		await sheet.flush();
		expect(updateCellsRows).toEqual([100]);
		expect(sheet.sentCount).toBe(100);

		await sheet.flush();
		expect(updateCellsRows).toEqual([100]);
		expect(sheet.sentCount).toBe(100);
	});
});
