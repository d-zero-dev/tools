import { delay } from '@d-zero/shared/delay';
import c from 'ansi-colors';

import { Dealer, Lanes } from '../dist/index.js';

const lanes = new Lanes();

lanes.header(`${c.red.bold('Header')} %earth% %dots%`);

/**
 * @typedef {(type: string, index?: number, delay?: number) => Promise<void> | void} StepListener
 */

/**
 *
 */
class Steps {
	/**
	 * @type {StepListener | null}
	 */
	#listener = null;

	/**
	 * @type {number[]}
	 */
	#steps;

	/**
	 * @param {number[]} steps
	 */
	constructor(steps) {
		this.#steps = steps;
	}

	/**
	 *
	 * @param {StepListener} listener
	 */
	addListener(listener) {
		this.#listener = listener;
	}

	async start() {
		const steps = [...this.#steps];
		let i = 0;
		for (const step of steps) {
			await delay(step, (determinedInterval) => {
				this.#listener?.('step', i, determinedInterval);
			});
			i++;
		}
		await this.#listener?.('end', i, 0);
	}
}

const stepsCollection = [
	new Steps([1300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([3200, 400, 300, 200]),
	new Steps([3010, 400, 300, 200]),
	new Steps([3100, 400, 300, 200]),
	new Steps([1300, 400, 300, 200]),
	new Steps([3001, 400, 300, 200]),
	new Steps([3010, 400, 300, 200]),
	new Steps([3300, 400, 300, 200]),
	new Steps([1300, 400, 300, 200]),
	new Steps([3020, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 200]),
	new Steps([300, 400, 300, 2000]),
	new Steps([300, 400, 300, 3000]),
];

const dealer = new Dealer(stepsCollection);

dealer.debug((log) => {
	lanes.update(-999, `[DEBUG]: ${log}`);
});

await dealer.setup(async (steps, index) => {
	await Promise.resolve();

	steps.addListener((type, stepCount, delay) => {
		lanes.update(
			index,
			`[${index}] ${stepCount}: ${type} %countdown(${delay},${index}_${stepCount})%ms`,
		);
	});

	return async () => {
		await steps.start();
		lanes.delete(index);
	};
});

dealer.finish(() => {
	lanes.close();
});

dealer.play();
