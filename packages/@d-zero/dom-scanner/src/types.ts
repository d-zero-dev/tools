export type ProcessorType = 'html' | 'pug';

export interface ScanOptions {
	extensions?: string[];
	processor?: ProcessorType;
	verbose?: boolean;
	ignore?: string[];
	excludeDirs?: string[];
}

export interface ScanResult {
	filePath: string;
	count: number;
}

export interface ScanSummary {
	results: ScanResult[];
	totalFiles: number;
	totalMatches: number;
}

export const DEFAULT_PROCESSOR_MAP: Record<string, ProcessorType> = {
	html: 'html',
	htm: 'html',
	pug: 'pug',
};

export const DEFAULT_EXTENSIONS = ['html', 'htm'];
