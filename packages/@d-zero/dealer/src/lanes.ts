import type { Animations, FPS } from './types.js';

import { Display } from './display.js';

type Log = [id: number, message: string];
type SortFunc = (a: Log, b: Log) => number;

export type LanesOptions = {
	animations?: Animations;
	fps?: FPS;
	indent?: string;
	sort?: SortFunc;
};

export class Lanes {
	#display: Display;
	#header?: string;
	#indent = '';

	#logs = new Map<number, string>();

	#sort: SortFunc = ([a], [b]) => a - b;

	constructor(options?: LanesOptions) {
		this.#display = new Display({
			animations: options?.animations,
			fps: options?.fps,
		});
		this.#indent = options?.indent ?? this.#indent;
		this.#sort = options?.sort ?? this.#sort;
	}

	close() {
		this.#display.close();
	}

	delete(id: number) {
		this.#logs.delete(id);
		this.write();
	}

	header(text: string) {
		this.#header = text;
		this.write();
	}

	update(id: number, log: string) {
		this.#logs.set(id, log);
		this.write();
	}

	write() {
		const logs = [...this.#logs.entries()];
		logs.sort(this.#sort);
		const messages = logs.map(([, message]) => `${this.#indent}${message}`);
		if (this.#header) {
			messages.unshift(this.#header);
		}
		this.#display.write(...messages);
	}
}
