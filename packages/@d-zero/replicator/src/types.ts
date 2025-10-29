export interface ReplicateOptions {
	verbose?: boolean;
	timeout?: number;
	devices?: Record<string, { width: number; resolution?: number }>;
}

export interface Resource {
	url: string;
	localPath: string;
	content?: Buffer;
}
