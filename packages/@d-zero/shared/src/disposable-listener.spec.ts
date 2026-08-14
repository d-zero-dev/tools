import { EventEmitter } from 'node:events';

import { describe, test, expect, vi } from 'vitest';

import { disposableListener } from './disposable-listener.js';

describe('disposableListener', () => {
	test('registers the listener on creation and removes it on scope exit', () => {
		// eslint-disable-next-line unicorn/prefer-event-target -- disposableListener は on/off 型エミッタ（EventEmitter / puppeteer Page）専用で、addEventListener 型の EventTarget は対象外
		const emitter = new EventEmitter();
		const listener = vi.fn();

		{
			using _sub = disposableListener(emitter, 'ping', listener);
			void _sub;
			emitter.emit('ping', 'a');
			expect(listener).toHaveBeenCalledWith('a');
		}

		emitter.emit('ping', 'b');
		expect(listener).toHaveBeenCalledTimes(1);
		expect(emitter.listenerCount('ping')).toBe(0);
	});

	test('removes only its own listener, leaving others registered', () => {
		// eslint-disable-next-line unicorn/prefer-event-target -- disposableListener は on/off 型エミッタ（EventEmitter / puppeteer Page）専用で、addEventListener 型の EventTarget は対象外
		const emitter = new EventEmitter();
		const managed = vi.fn();
		const unmanaged = vi.fn();
		emitter.on('ping', unmanaged);

		{
			using _sub = disposableListener(emitter, 'ping', managed);
			void _sub;
		}

		emitter.emit('ping');
		expect(managed).not.toHaveBeenCalled();
		expect(unmanaged).toHaveBeenCalledTimes(1);
	});
});
