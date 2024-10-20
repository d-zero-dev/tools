import type { Animations, FPS } from './types.js';

import { Display } from './display.js';

type Log = readonly [id: number, message: string];
type SortFunc = (a: Log, b: Log) => number;

export type LanesOptions = {
	readonly animations?: Animations;
	readonly fps?: FPS;
	readonly indent?: string;
	readonly sort?: SortFunc;
	readonly verbose?: boolean;
};

export class Lanes {
	#display: Display;
	#header?: string;
	#indent = '';
	#logs = new Map<number, string>();
	#verbose: boolean;
	#sort: SortFunc = ([a], [b]) => a - b;

	constructor(options?: LanesOptions) {
		this.#display = new Display({
			animations: options?.animations,
			fps: options?.fps,
			verbose: options?.verbose,
		});
		this.#indent = options?.indent ?? this.#indent;
		this.#sort = options?.sort ?? this.#sort;
		this.#verbose = options?.verbose ?? false;
	}

	close() {
		this.#display.close();
	}

	delete(id: number) {
		if (this.#verbose) {
			return;
		}

		this.#logs.delete(id);
		this.write();
	}

	header(text: string) {
		this.#header = text;

		if (this.#verbose) {
			return;
		}

		this.write();
	}

	update(id: number, log: string) {
		if (this.#verbose) {
			this.#display.write(this.#header + ' ' + log);
			return;
		}

		this.#logs.set(id, log);
		this.write();
	}

	write() {
		if (this.#verbose) {
			return;
		}

		const logs = [...this.#logs.entries()];
		logs.sort(this.#sort);
		const messages = logs.map(([, message]) => `${this.#indent}${message}`);
		if (this.#header) {
			messages.unshift(...this.#header.split('\n'));
		}
		this.#display.write(...messages);
	}
}
