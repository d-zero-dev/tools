import type { Animations, FPS } from './types.js';

import { Display } from './display.js';

const RESET = '\u001B[0m';

type Log = readonly [id: number, message: string];
type SortFunc = (a: Log, b: Log) => number;

/** Configuration options for the {@link Lanes} display manager. */
export type LanesOptions = {
	/** Custom animation definitions to override or extend built-in presets */
	readonly animations?: Animations;
	/** Frame rate for display rendering */
	readonly fps?: FPS;
	/** Indent string prepended to each log line */
	readonly indent?: string;
	/** Sort function for ordering log entries by their ID */
	readonly sort?: SortFunc;
	/** When true, logs are appended line-by-line to stdout instead of being redrawn in-place */
	readonly verbose?: boolean;
};

/**
 * Manages multiple concurrent log lines with ordered display output.
 * Each log line is identified by a numeric ID and can be independently updated or deleted.
 */
export class Lanes {
	#display: Display;
	#header?: string;
	#indent = '';
	#logs = new Map<number, string>();
	#sort: SortFunc = ([a], [b]) => a - b;
	#verbose: boolean;

	/**
	 * @param options - Display configuration options
	 */
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

	/**
	 * Clears all log entries. No-op in verbose mode.
	 * @param options - Pass `{ header: true }` to also clear the header
	 * @param options.header
	 */
	clear(options?: { header?: boolean }) {
		if (this.#verbose) {
			return;
		}

		this.#logs.clear();

		if (options?.header) {
			this.#header = undefined;
		}

		this.write();
	}
	/**
	 * Closes the underlying display and releases resources.
	 */
	close() {
		this.#display.close();
	}

	/**
	 * Removes the log entry with the given ID. No-op in verbose mode.
	 * @param id - The log entry ID to remove
	 */
	delete(id: number) {
		if (this.#verbose) {
			return;
		}

		this.#logs.delete(id);
		this.write();
	}

	/**
	 * Sets the header text displayed above all log lines.
	 * @param text - Header text to display
	 */
	header(text: string) {
		this.#header = text;

		if (this.#verbose) {
			return;
		}

		this.write();
	}

	/**
	 * Updates the log entry for the given ID. In verbose mode, immediately writes the header and log to stdout.
	 * @param id - The log entry ID
	 * @param log - The log message
	 */
	update(id: number, log: string) {
		if (this.#verbose) {
			this.#display.write(`${RESET}${this.#header}${RESET} ${log}`);
			return;
		}

		this.#logs.set(id, log);
		this.write();
	}

	/**
	 * Renders all current log entries to the display. No-op in verbose mode.
	 * Entries are sorted by the configured sort function before rendering.
	 */
	write() {
		if (this.#verbose) {
			return;
		}

		const logs = [...this.#logs.entries()];
		logs.sort(this.#sort);
		const messages = logs.map(([, message]) => `${this.#indent}${message}`);
		if (this.#header) {
			messages.unshift(
				...this.#header.split('\n').map((line) => `${RESET}${line}${RESET}`),
			);
		}
		this.#display.write(...messages);
	}
}
