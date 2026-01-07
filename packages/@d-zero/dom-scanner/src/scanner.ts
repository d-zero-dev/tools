import type { ScanOptions, ScanResult, ScanSummary } from './types.js';

import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { parseFile } from './parser.js';
import { DEFAULT_EXTENSIONS } from './types.js';

/**
 * ファイルパスが無視パターンにマッチするかチェック
 * @param filePath
 * @param ignorePatterns
 */
function shouldIgnore(filePath: string, ignorePatterns?: string[]): boolean {
	if (!ignorePatterns || ignorePatterns.length === 0) {
		return false;
	}

	for (const pattern of ignorePatterns) {
		if (filePath.includes(pattern)) {
			return true;
		}
	}

	return false;
}

/**
 * ファイル拡張子が対象かチェック
 * @param filePath
 * @param extensions
 */
function matchesExtension(filePath: string, extensions: string[]): boolean {
	const ext = path.extname(filePath).slice(1).toLowerCase();
	return extensions.includes(ext);
}

/**
 * ディレクトリを再帰的にスキャンしてファイルを収集
 * @param dirPath
 * @param extensions
 * @param ignorePatterns
 * @param excludeDirs
 */
async function collectFiles(
	dirPath: string,
	extensions: string[],
	ignorePatterns?: string[],
	excludeDirs?: string[],
): Promise<string[]> {
	const files: string[] = [];
	const excludeDirsSet =
		excludeDirs && excludeDirs.length > 0 ? new Set(excludeDirs) : new Set<string>();

	const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => {
		// エラーは無視（権限エラーなど）
		return [];
	});

	for (const entry of entries) {
		const fullPath = path.join(dirPath, entry.name);

		if (entry.isDirectory()) {
			// 除外ディレクトリをスキップ
			if (excludeDirsSet.has(entry.name)) {
				continue;
			}

			// 無視パターンにマッチする場合はスキップ
			if (shouldIgnore(fullPath, ignorePatterns)) {
				continue;
			}

			// 再帰的に探索
			const subFiles = await collectFiles(
				fullPath,
				extensions,
				ignorePatterns,
				excludeDirs,
			);
			files.push(...subFiles);
		} else if (entry.isFile()) {
			// 無視パターンにマッチする場合はスキップ
			if (shouldIgnore(fullPath, ignorePatterns)) {
				continue;
			}

			// 拡張子が対象の場合のみ追加
			if (matchesExtension(fullPath, extensions)) {
				files.push(fullPath);
			}
		}
	}

	return files;
}

/**
 * ディレクトリをスキャンして要素を検索
 * @param directory
 * @param selector
 * @param options
 */
export async function scanDirectory(
	directory: string,
	selector: string,
	options?: ScanOptions,
): Promise<ScanSummary> {
	const extensions = options?.extensions ?? DEFAULT_EXTENSIONS;
	const processor = options?.processor;
	const verbose = options?.verbose ?? false;
	const ignorePatterns = options?.ignore;
	const excludeDirs = options?.excludeDirs;

	if (verbose) {
		process.stdout.write(`スキャン中: ${directory}\n`);
		process.stdout.write(`対象拡張子: ${extensions.join(', ')}\n`);
	}

	const files = await collectFiles(directory, extensions, ignorePatterns, excludeDirs);

	if (verbose) {
		process.stdout.write(`見つかったファイル数: ${files.length}\n`);
	}

	const results: ScanResult[] = [];
	let totalMatches = 0;

	for (const filePath of files) {
		try {
			const count = await parseFile(filePath, selector, processor);

			if (count > 0) {
				results.push({
					filePath,
					count,
				});
				totalMatches += count;
			}

			if (verbose) {
				process.stdout.write(`  ${filePath}: ${count}件\n`);
			}
		} catch (error) {
			if (verbose) {
				process.stderr.write(
					`  ${filePath}: エラー - ${error instanceof Error ? error.message : String(error)}\n`,
				);
			}
			// エラーが発生したファイルはスキップ
		}
	}

	return {
		results,
		totalFiles: results.length,
		totalMatches,
	};
}
