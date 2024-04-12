export type Sizes = Record<string, Size>;

export type Size = { width: number; resolution?: number };

export type Screenshot = {
	binary: Buffer;
} & Size;

export type Phase = {
	setViewport: { name: string; width: number; resolution?: number };
	load: { name: string; type: 'open' | 'reaload' };
	scroll: { name: string };
	screenshotStart: { name: string };
	screenshotEnd: { name: string; binary: Buffer };
};

export type Listener = (phase: keyof Phase, data: Phase[keyof Phase]) => void;
