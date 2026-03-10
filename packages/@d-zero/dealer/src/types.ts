/** Mapping of animation names to their frame rate and sprite sequences. */
export type Animations = Record<string, [fps: number, ...sprites: string[]]>;

/** Supported frame rates for display rendering. */
export type FPS = 12 | 24 | 30 | 60;

/**
 * Function that initializes an item and returns its start function.
 * @template T - The type of item being initialized
 * @param process - The item to initialize
 * @param index - The sequential index assigned to the item
 * @returns A start function that performs the actual processing
 */
export interface ProcessInitializer<T> {
	(process: T, index: number): Promise<() => Promise<void> | void>;
}
