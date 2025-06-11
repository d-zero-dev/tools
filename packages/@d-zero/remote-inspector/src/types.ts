import type { BaseCLIOptions } from '@d-zero/cli-core';

export interface RemoteInspectorOptions extends BaseCLIOptions {
	host?: string;
	user?: string;
	keyPath?: string;
	passphrase?: string;
	remoteDir?: string;
	localDir?: string;
	listfile?: string;
}

export interface ConnectionConfig {
	host: string;
	username: string;
	privateKey: Buffer;
	passphrase?: string;
}

export interface FileComparison {
	localPath: string;
	remotePath: string;
	relativePath: string;
	isTextFile: boolean;
	status: 'same' | 'modified' | 'new' | 'missing';
	localSize?: number;
	remoteSize?: number;
	diff?: string;
}