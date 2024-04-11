import type { Animations, FPS } from './types.js';

import readline from 'node:readline';

import c from 'ansi-colors';

import { countDownFunctionParser } from './count-down-function-parser.js';
import { riffle } from './riffle.js';

const RESET = c.reset('');

const animationPresets: Animations = {
	earth: [2, '🌏', '🌍', '🌎'],
	dots: [5, '.  ', '.. ', '...'],
	block: [20, '▘', '▀', '▜', '▉', '▟', '▃', '▖', ' '],
	propeller: [25, '\\', '|', '/', '-'],
};

interface Options {
	animations?: Animations;
	fps?: FPS;
}

export class Display {
	#animations: Animations;
	#coundDownMap = new Map<string, number>();
	#debugMessages: string[] = [];
	#frameInterval: number;
	#lastWroteLineNum = 0;
	#stack: string[] | null = null;
	readonly #startTime = Date.now();
	#timer: ReturnType<typeof setTimeout> | null = null;

	#verbose = false;

	constructor(options?: Options) {
		this.#animations = {
			...animationPresets,
			...options?.animations,
		};

		const fps = options?.fps ?? 30;
		this.#frameInterval = 1000 / fps;

		process.stdout.on('resize', () => this.#resize());
	}

	close() {
		if (this.#verbose) {
			return;
		}

		if (this.#timer) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}

		this.#write();

		this.#lastWroteLineNum = 0;
		this.#stack = null;
	}

	verboseMode() {
		this.#verbose = true;
	}

	write(...logs: string[]) {
		if (this.#verbose) {
			process.stdout.write(logs.map((log) => log.trim()).join('\n'));
			return;
		}

		this.#stack = [...this.#debugMessages, ...logs];
		if (this.#timer) {
			return;
		}

		this.#enterFrame();
	}

	#clear() {
		if (this.#verbose) {
			return;
		}

		for (let i = 0; i < this.#lastWroteLineNum; i++) {
			readline.moveCursor(process.stdout, 0, -1);
			readline.cursorTo(process.stdout, 0);
			readline.clearLine(process.stdout, 0);
		}
	}

	#countDown(text: string) {
		const parsed = countDownFunctionParser(text);

		if (!parsed) {
			return text;
		}

		const { id, time, placeholder, unit } = parsed;

		const currentTime = this.#coundDownMap.get(id);

		let displayTimeMS: number;

		if (currentTime == null) {
			this.#coundDownMap.set(id, Date.now());
			displayTimeMS = time;
		} else {
			const elapsedTime = Date.now() - currentTime;
			displayTimeMS = Math.max(time - elapsedTime, 0);
		}

		const displayTime = unit === 's' ? Math.round(displayTimeMS / 1000) : displayTimeMS;

		return text.replace(placeholder, `${displayTime}`);
	}

	#enterFrame() {
		this.#timer = setTimeout(() => this.#enterFrame(), this.#frameInterval);
		this.#write();
	}

	#resize() {
		if (this.#verbose) {
			return;
		}

		this.#write();
	}

	#write() {
		if (!this.#stack) {
			return;
		}

		this.#clear();

		for (const stack of this.#stack) {
			let text = riffle(stack, Date.now() - this.#startTime, this.#animations);
			text = this.#countDown(text);
			const displayText = text.slice(0, process.stdout.columns);
			process.stdout.write(`${RESET}${displayText}${RESET}\n`);
		}

		this.#lastWroteLineNum = this.#stack.length;
	}
}
