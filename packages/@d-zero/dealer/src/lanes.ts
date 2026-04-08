import type { Animations, FPS } from './types.js';

import { Display } from './display.js';

const RESET = '\u001B[0m';

type Log = readonly [id: number, message: string];
type SortFunc = (a: Log, b: Log) => number;

/**
 * {@link Lanes} のコンストラクタオプション。
 */
export type LanesOptions = {
	readonly animations?: Animations;
	readonly fps?: FPS;
	readonly indent?: string;
	readonly sort?: SortFunc;
	readonly verbose?: boolean;
};

/**
 * 複数のログラインを管理し、順序付きでターミナルに表示するクラス。
 * verbose モードでは上書き表示ではなく追記出力を行う。
 */
export class Lanes {
	#display: Display;
	#header?: string;
	#indent = '';
	#logs = new Map<number, string>();
	#sort: SortFunc = ([a], [b]) => a - b;
	#verbose: boolean;

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
	 * すべてのログをクリアする。verbose モードでは何もしない。
	 * @param options - クリアオプション
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
	 * ディスプレイを閉じ、リソースを解放する。
	 */
	close() {
		this.#display.close();
	}

	/**
	 * 指定した ID のログを削除する。verbose モードでは何もしない。
	 * @param id - 削除するログの ID
	 */
	delete(id: number) {
		if (this.#verbose) {
			return;
		}

		this.#logs.delete(id);
		this.write();
	}

	/**
	 * ヘッダーテキストを設定する。
	 * @param text - ヘッダーとして表示する文字列
	 */
	header(text: string) {
		this.#header = text;

		if (this.#verbose) {
			return;
		}

		this.write();
	}

	/**
	 * 指定した ID のログを更新する。
	 * verbose モードではヘッダーとログを連結して即時出力する。
	 * @param id - 更新するログの ID
	 * @param log - ログメッセージ
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
	 * 現在のログをソートしてターミナルに表示する。
	 * verbose モードでは何もしない。
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
