export interface ReplicateOptions {
	verbose?: boolean;
	userAgent?: string;
	timeout?: number;
}

export interface Resource {
	url: string;
	localPath: string;
	type: 'html' | 'css' | 'js' | 'image' | 'font' | 'other';
	content?: Buffer;
}
