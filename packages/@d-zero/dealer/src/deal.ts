import type { DealerOptions } from './dealer.js';
import type { LanesOptions } from './lanes.js';

import { Dealer } from './dealer.js';
import { Lanes } from './lanes.js';

type Options = DealerOptions &
	LanesOptions & {
		header?: (progress: number, done: number, total: number, limit: number) => string;
		debug?: boolean;
	};

const DEBUG_ID = Number.MIN_SAFE_INTEGER;

export async function deal<T extends WeakKey>(
	items: readonly T[],
	setup: (
		process: T,
		update: (log: string) => void,
		index: number,
	) => Promise<() => void | Promise<void>>,
	options?: Options,
) {
	const dealer = new Dealer(items, options);
	const lanes = new Lanes(options);

	if (options?.header) {
		dealer.progress((progress, done, total, limit) => {
			lanes.header(options.header!(progress, done, total, limit));
		});
	}

	await dealer.setup(async (process, index) => {
		const update = (log: string) => lanes.update(index, log);
		const start = await setup(process, update, index);
		return async () => {
			await start();
			lanes.delete(index);
		};
	});

	if (options?.debug) {
		dealer.debug((log) => {
			lanes.update(DEBUG_ID, `[DEBUG]: ${log}`);
		});
	}

	return new Promise<void>((resolve) => {
		dealer.finish(() => {
			lanes.close();
			resolve();
		});

		dealer.play();
	});
}
