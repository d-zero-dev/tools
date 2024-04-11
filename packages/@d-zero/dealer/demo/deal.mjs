import c from 'ansi-colors';

import { deal } from '../dist/index.js';

/**
 * @typedef {(type: string, index?: number, delay?: number) => Promise<void> | void} StepListener
 */

/**
 *
 */
class Steps {
	/**
	 * @param {number[]} steps
	 */
	constructor(steps) {
		this.#steps = steps;
	}
	/**
	 * @type {number[]}
	 */
	#steps;

	/**
	 * @type {StepListener}
	 */
	#listener;

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
			await this.#listener('step', i, step);
			await delay(step);
			i++;
		}
		await this.#listener('end', i, 0);
	}
}

/**
 * @param {number} ms
 * @return {Promise<void>}
 */
function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
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

await deal(
	stepsCollection,
	(steps, update, index) => {
		steps.addListener((type, stepCount, delay) => {
			update(
				`[${index}] ${stepCount}: ${type} %countdown(${delay},${index}_${stepCount})%ms`,
			);
		});

		return async () => {
			await steps.start();
		};
	},
	{
		limit: 15,
		header: (progress, done, total, limit) =>
			progress === 1
				? `${c.green.bold('Header')} %earth% %dots% Done! ${done}/${total} (${limit})`
				: `${c.red.bold('Header')} %earth% %dots% %block% %propeller% ${done}/${total} (${limit})`,
	},
);

// eslint-disable-next-line no-console
console.log('✨ Done!');
