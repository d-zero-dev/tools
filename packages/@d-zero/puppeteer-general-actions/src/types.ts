export type Listener<P> = (phase: keyof P, data: P[keyof P]) => void;

export type Loggers<P> = (log: (log: string) => void) => {
	[K in keyof P]?: (data: P[K]) => void;
};
