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
	username?: string;
	password?: string;
}

export interface Resource {
	url: string;
	localPath: string;
}

export interface ChildProcessInput {
	devices?: Record<string, { width: number; resolution?: number }>;
	timeout?: number;
	username?: string;
	password?: string;
}

export interface ChildProcessResult {
	url: string;
	encodedUrls: string[];
}
