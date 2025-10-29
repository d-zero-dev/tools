export interface ReplicateOptions {
	urls: string[];
	outputDir: string;
	verbose?: boolean;
	timeout?: number;
	devices?: Record<string, { width: number; resolution?: number }>;
	limit?: number;
}

export interface Resource {
	url: string;
	localPath: string;
}

export interface ChildProcessInput {
	url: string;
	outputDir: string;
	devices?: Record<string, { width: number; resolution?: number }>;
	timeout?: number;
}

export interface ChildProcessResult {
	url: string;
	encodedUrls: string[];
}
