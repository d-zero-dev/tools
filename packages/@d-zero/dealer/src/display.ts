import type { Animations, FPS } from './types.js';

import { countDownFunctionParser } from './count-down-function-parser.js';
import { riffle } from './riffle.js';

const RESET = '\u001B[0m';
const CURSOR_UP = (n: number) => `\u001B[${n}A`;
const CURSOR_TO_COL0 = '\u001B[G';
const ERASE_DOWN = '\u001B[0J';

const animationPresets: Animations = {
	earth: [2, '🌏', '🌍', '🌎'],
	dots: [5, '.  ', '.. ', '...'],
	block: [20, '▘', '▀', '▜', '▉', '▟', '▃', '▖', ' '],
	propeller: [25, '\\', '|', '/', '-'],
	braille: [10, '⠄', '⠂', '⠁', '⠈', '⠐', '⠠'],
};

interface Options {
	animations?: Animations;
	fps?: FPS;
	verbose?: boolean;
	/**
	 * 出力先のストリーム。省略時は `process.stdout`。
	 * `process.stderr` のような別ストリームを指定すると、フレーム描画・verbose
	 * 出力・resize ハンドラ・カラム幅取得のすべてがそのストリームに向く。
	 * page-cluster CLI のように stdout を別用途 (JSONL 出力) に使うツールが
	 * stderr へ進捗を出すために追加された。
	 */
	stream?: NodeJS.WritableStream;
}

export class Display {
	#animations: Animations;
	#closed = false;
	#coundDownMap = new Map<string, number>();
	#debugMessages: string[] = [];
	#frameInterval: number;
	#lastWroteLineNum = 0;
	#resizeHandler: (() => void) | null = null;
	#sigintHandler: (() => void) | null = null;
	#stack: string[] | null = null;
	readonly #startTime = Date.now();
	#stream: NodeJS.WritableStream;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#verbose: boolean;

	constructor(options?: Options) {
		this.#animations = {
			...animationPresets,
			...options?.animations,
		};

		const fps = options?.fps ?? 30;
		this.#frameInterval = 1000 / fps;

		this.#verbose = options?.verbose ?? false;
		this.#stream = options?.stream ?? process.stdout;

		this.#resizeHandler = () => this.#resize();
		// resize は TTY WriteStream でしか発火しないが、Writable (EventEmitter)
		// なら .on 自体は存在するので runtime エラーにはならない。
		(this.#stream as NodeJS.EventEmitter).on?.('resize', this.#resizeHandler);

		if (!this.#verbose) {
			this.#sigintHandler = () => {
				this.#close();
				process.exit(130);
			};
			process.on('SIGINT', this.#sigintHandler);
		}
	}

	/**
	 * `using` 宣言のスコープ脱出時に呼ばれ、{@link Display.close} と同じ解放処理を行う。
	 * @example
	 * ```ts
	 * {
	 *   using display = new Display();
	 *   display.write('processing...');
	 * } // スコープ脱出時に自動でタイマー・リスナーが解放される
	 * ```
	 */
	[Symbol.dispose]() {
		this.#close();
	}
	/**
	 * ディスプレイを閉じ、タイマー・resize リスナー・SIGINT ハンドラを解放する。
	 * 複数回呼び出しても安全（冪等）。
	 * @deprecated `using` 宣言（`Symbol.dispose`）による自動解放を使用すること。
	 * スコープと解放タイミングが一致しない場合のみ直接呼び出す。
	 */
	close() {
		this.#close();
	}

	verboseMode() {
		this.#verbose = true;
	}
	write(...logs: string[]) {
		// After close() the lifecycle is finished: timers and signal listeners
		// have been released, so a late write() must not re-arm setTimeout (the
		// very leak close() exists to stop) or print past a "finalized" frame
		if (this.#closed) {
			return;
		}

		if (this.#verbose) {
			for (const log of logs) {
				this.#stream.write(this.#text(log, false) + '\n');
			}
			return;
		}

		this.#stack = [...this.#debugMessages, ...logs];
		this.#dropStaleCountDowns();

		if (this.#timer) {
			return;
		}

		this.#enterFrame();
	}
	#close() {
		if (this.#closed) {
			return;
		}
		this.#closed = true;

		if (this.#timer) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}

		// Verbose mode has no interactive frame to finalize, but the process
		// listeners registered in the constructor must still be released —
		// otherwise repeated Display lifecycles leak resize/SIGINT listeners
		if (!this.#verbose) {
			this.#write();
		}

		if (this.#resizeHandler) {
			(this.#stream as NodeJS.EventEmitter).off?.('resize', this.#resizeHandler);
			this.#resizeHandler = null;
		}

		if (this.#sigintHandler) {
			process.off('SIGINT', this.#sigintHandler);
			this.#sigintHandler = null;
		}

		this.#lastWroteLineNum = 0;
		this.#stack = null;
	}

	#countDown(text: string) {
		const parsed = countDownFunctionParser(text);

		if (!parsed) {
			return text;
		}

		const { id, time, placeholder, unit } = parsed;

		let displayTimeMS: number;

		if (this.#verbose) {
			// verbose モードには繰り返し描画されるフレームが存在せず、1行は
			// 出力された瞬間に確定する。カウントダウン行が出るのは待機の開始
			// 時点なので満了時間をそのまま出す。開始時刻を残さないため、同じ
			// ID の次の行が前回の経過時間を引き継ぐこともない。
			displayTimeMS = time;
		} else {
			const currentTime = this.#coundDownMap.get(id);

			if (currentTime == null) {
				this.#coundDownMap.set(id, Date.now());
				displayTimeMS = time;
			} else {
				const elapsedTime = Date.now() - currentTime;
				displayTimeMS = Math.max(time - elapsedTime, 0);
			}
		}

		const displayTime = unit === 's' ? Math.round(displayTimeMS / 1000) : displayTimeMS;

		return text.replace(placeholder, `${displayTime}`);
	}

	/**
	 * 表示スタックから消えたカウントダウン ID の開始時刻を破棄する。
	 *
	 * カウントダウンの開始時刻は「その placeholder が表示スタックに載っている
	 * 間」だけ有効な状態。破棄することで、同じ ID が再登場したとき——リトライで
	 * 同じページを開き直す、レーン番号だけを ID にした待機が次のアイテムで再び
	 * 出る、など——に満了時間から数え直せる。残したままにすると前回の開始時刻を
	 * 引き継ぎ、経過時間が満了時間を超えているため残り 0 に張り付く。Map が実行
	 * 中ずっと ID を抱え続けるのも防ぐ。
	 *
	 * フレーム描画時ではなくスタック更新時に判定するのは、フレーム間隔 (既定
	 * 33ms) より短い間に「消えて再登場」した ID を取りこぼさないため。
	 */
	#dropStaleCountDowns() {
		if (this.#coundDownMap.size === 0) {
			return;
		}

		const liveIds = new Set<string>();
		for (const line of this.#stack ?? []) {
			// riffle が置換するのは `%earth%` のようなアニメーション名のみで
			// `%countdown(...)%` には触れないため、描画前の生の行で判定できる。
			const parsed = countDownFunctionParser(line);
			if (parsed) {
				liveIds.add(parsed.id);
			}
		}

		for (const id of this.#coundDownMap.keys()) {
			if (!liveIds.has(id)) {
				this.#coundDownMap.delete(id);
			}
		}
	}

	#enterFrame() {
		if (this.#verbose) {
			return;
		}

		this.#timer = setTimeout(() => this.#enterFrame(), this.#frameInterval);
		this.#write();
	}

	#resize() {
		if (this.#verbose) {
			return;
		}

		this.#write();
	}

	#text(text: string, trim = true) {
		text = riffle(text, Date.now() - this.#startTime, this.#animations, this.#verbose);
		text = this.#countDown(text);
		text = text.replaceAll(/\r?\n/g, ' ');
		if (trim) {
			const columns = (this.#stream as { columns?: number }).columns;
			text = text.slice(0, columns);
		}
		return `${RESET}${text}${RESET}`;
	}

	#write() {
		if (!this.#stack) {
			return;
		}

		const outputBuffer: string[] = [];
		for (const stack of this.#stack) {
			outputBuffer.push(this.#text(stack));
		}

		const content = outputBuffer.join('\n') + '\n';

		let output = '';
		if (this.#lastWroteLineNum > 0) {
			output += CURSOR_UP(this.#lastWroteLineNum) + CURSOR_TO_COL0 + ERASE_DOWN;
		}
		output += content;

		this.#stream.write(output);
		this.#lastWroteLineNum = this.#stack.length;
	}
}
