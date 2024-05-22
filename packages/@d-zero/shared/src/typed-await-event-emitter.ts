import AwaitEventEmitter from 'await-event-emitter';

/**
 * An event emitter that supports typed events and asynchronous event handling.
 *
 * @template E - The type of events and their corresponding arguments.
 */
export class TypedAwaitEventEmitter<E> {
	readonly #emitter = new AwaitEventEmitter.default();

	/**
	 * Asynchronously emits an event with the specified arguments.
	 *
	 * @param event - The event to emit.
	 * @param arg - The argument associated with the event.
	 * @returns A promise that resolves to a boolean indicating whether any listeners were called.
	 */
	async emit<T extends keyof E>(event: T, arg: E[T]): Promise<boolean> {
		const result = await this.#emitter.emit(event, arg);
		return !!result;
	}

	/**
	 * Synchronously emits an event with the specified arguments.
	 *
	 * @param event - The event to emit.
	 * @param arg - The argument associated with the event.
	 * @returns A boolean indicating whether any listeners were called.
	 */
	emitSync<T extends keyof E>(event: T, arg: E[T]): boolean {
		const result = this.#emitter.emitSync(event, arg);
		return !!result;
	}

	/**
	 * Adds a listener for the specified event.
	 *
	 * @param event - The event to listen for.
	 * @param listener - The listener function to be called when the event is emitted.
	 * @returns The instance of the `TypedAwaitEventEmitter` class.
	 */
	on<T extends keyof E>(event: T, listener: (arg: E[T]) => Promise<void> | void): this {
		this.#emitter.on(event, listener);
		return this;
	}
}
