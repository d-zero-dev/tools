/**
 * Display flicker stress test — for manual visual verification.
 *
 * Simulates heavy subprocess workloads (like puppeteer-dealer) by:
 *   - Spawning real child processes (`sleep` commands) per step
 *   - Burning CPU in the main thread between steps (blocks event loop)
 *   - Allocating memory buffers to simulate data processing
 *   - Rapid-fire update() calls (~every 30ms) during blocking work
 *
 * Run: node packages/@d-zero/dealer/demo/stress.mjs
 *
 * What to look for:
 *   - No blank flashes between frames
 *   - No leftover "ghost" lines when row count shrinks
 *   - Smooth animation under real system load
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import c from 'ansi-colors';

import { deal } from '../dist/index.js';

const execFileAsync = promisify(execFile);

const TOTAL = 120;
const CONCURRENCY = 30;

/**
 * @param {number} min
 * @param {number} max
 */
function rand(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** @param {number} ms */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Block the event loop for ~durationMs by busy-waiting.
 * This simulates heavy sync work (image processing, DOM parsing, etc.)
 * Calls `tick` periodically so the display can still be updated.
 * @param {number} durationMs
 * @param {(elapsed: number, total: number) => void} tick
 */
function cpuBurn(durationMs, tick) {
	const start = Date.now();
	const tickInterval = 30;
	let nextTick = start + tickInterval;
	while (Date.now() - start < durationMs) {
		// Busy work: allocate and fill a buffer to pressure GC
		const buf = Buffer.alloc(1024 * 64);
		buf.fill(Math.random() * 255);
		void buf[0];

		const now = Date.now();
		if (now >= nextTick) {
			tick(now - start, durationMs);
			nextTick = now + tickInterval;
		}
	}
	tick(durationMs, durationMs);
}

/**
 * Spawn a real `sleep` subprocess.
 * @param {number} seconds
 */
async function spawnSleep(seconds) {
	await execFileAsync('sleep', [String(seconds)]);
}

const items = Array.from({ length: TOTAL }, (_, i) => ({
	id: i,
	steps: rand(3, 6),
	// Each step is one of: subprocess, cpu-burn, or both
	plan: Array.from({ length: rand(3, 6) }, () => ({
		type: /** @type {const} */ (['subprocess', 'cpu', 'both'])[rand(0, 2)],
		subprocessSec: rand(1, 3) * 0.1, // 0.1–0.3s
		cpuMs: rand(50, 200),
	})),
}));

await deal(
	items,
	(item, update, _index, setLineHeader) => {
		const tag = `[${String(item.id).padStart(3, '0')}]`;
		setLineHeader(`${c.dim(tag)} `);

		return async () => {
			for (let s = 0; s < item.plan.length; s++) {
				const step = item.plan[s];
				const progress =
					c.green('\u2588'.repeat(s + 1)) +
					c.dim('\u2591'.repeat(item.plan.length - s - 1));

				if (step.type === 'subprocess' || step.type === 'both') {
					update(
						`%propeller% ${progress} step ${s + 1}/${item.plan.length} %earth% spawning sleep(${step.subprocessSec}s)...`,
					);
					await spawnSleep(step.subprocessSec);
				}

				if (step.type === 'cpu' || step.type === 'both') {
					cpuBurn(step.cpuMs, (elapsed, total) => {
						const pct = Math.round((elapsed / total) * 100);
						update(
							`%block% ${progress} step ${s + 1}/${item.plan.length} %braille% CPU burn ${pct}% (${elapsed}/${total}ms)`,
						);
					});
				}

				if (step.type === 'subprocess') {
					update(
						`%dots% ${progress} step ${s + 1}/${item.plan.length} %braille% subprocess done`,
					);
					await sleep(rand(20, 60));
				}
			}

			update(`${c.green.bold('\u2714')} done (${item.plan.length} steps)`);
			await sleep(40);
		};
	},
	{
		limit: CONCURRENCY,
		fps: 60,
		header: (progress, done, total, limit) => {
			const width = 30;
			const filled = Math.round(progress * width);
			const bar =
				c.green('\u2588'.repeat(filled)) + c.dim('\u2591'.repeat(width - filled));
			return progress === 1
				? `${c.green.bold('STRESS TEST COMPLETE')} ${bar} ${done}/${total}`
				: `${c.red.bold('STRESS TEST')} %earth% %block% %braille% ${bar} ${done}/${total} (limit: ${limit})`;
		},
	},
);

// eslint-disable-next-line no-console
console.log(
	`\n${c.green.bold('\u2728')} All ${TOTAL} items done (concurrency: ${CONCURRENCY}, fps: 60)`,
);
