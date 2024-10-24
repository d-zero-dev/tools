/**
 * A class representing a deferred promise.
 *
 * The `Deferred` class allows you to create a promise and resolve or reject it
 * at a later time. This can be useful for scenarios where you need to control
 * the timing of the promise resolution or rejection.
 *
 * @template T - The type of the value that the promise will resolve with.
 */
export class Deferred<T = void> {
	#promise: Promise<T>;
	#reject!: (reason?: unknown) => void;
	#resolve!: (value: T) => void;

	/**
	 * Creates an instance of the `Deferred` class.
	 *
	 * The constructor initializes the internal promise and sets up the resolve
	 * and reject functions.
	 */
	constructor() {
		this.#promise = new Promise<T>((resolve, reject) => {
			this.#resolve = resolve;
			this.#reject = reject;
		});
	}

	/**
	 * Returns the internal promise.
	 *
	 * @returns The promise that will be resolved or rejected.
	 */
	promise() {
		return this.#promise;
	}

	/**
	 * Rejects the internal promise with the given reason.
	 *
	 * @param reason The reason for rejecting the promise.
	 */
	reject(reason?: unknown) {
		this.#reject(reason);
	}

	/**
	 * Resolves the internal promise with the given value.
	 *
	 * @param value The value to resolve the promise with.
	 */
	resolve(value: T) {
		this.#resolve(value);
	}
}
