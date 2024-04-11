export type Animations = Record<string, [fps: number, ...sprites: string[]]>;

export type FPS = 12 | 24 | 30 | 60;

export interface ProcessInitializer<T> {
	(process: T, index: number): () => Promise<void> | void;
}
