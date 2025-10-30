import type { DelayOptions } from '@d-zero/shared/delay';

export interface ReplicateOptions {
	urls: string[];
	outputDir: string;
	verbose?: boolean;
	timeout?: number;
	devices?: Record<string, { width: number; resolution?: number }>;
	limit?: number;
	only?: 'page' | 'resource';
	interval?: number | DelayOptions;
}

export interface Resource {
	url: string;
	localPath: string;
}

export interface ChildProcessInput {
	devices?: Record<string, { width: number; resolution?: number }>;
	timeout?: number;
}

export interface ChildProcessResult {
	url: string;
	encodedUrls: string[];
}
