import type { ProcessorType } from './types.js';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import * as cheerio from 'cheerio';
// @ts-expect-error - pug doesn't have type definitions
import pug from 'pug';

import { DEFAULT_PROCESSOR_MAP } from './types.js';

/**
 * ファイル拡張子からデフォルトプロセッサーを取得
 * @param filePath
 */
export function getDefaultProcessor(filePath: string): ProcessorType {
	const ext = path.extname(filePath).slice(1).toLowerCase();
	return DEFAULT_PROCESSOR_MAP[ext] ?? 'html';
}

/**
 * HTMLファイルをパースして要素数をカウント
 * @param html
 * @param selector
 */
function parseHTML(html: string, selector: string): number {
	const $ = cheerio.load(html);
	return $(selector).length;
}

/**
 * PugファイルをコンパイルしてHTMLに変換し、要素数をカウント
 * @param pugContent
 * @param selector
 */
function parsePug(pugContent: string, selector: string): number {
	try {
		const compileFunction = pug.compile(pugContent, {
			basedir: process.cwd(),
		});
		const html = compileFunction();
		return parseHTML(html, selector);
	} catch (error) {
		throw new Error(
			`Pugコンパイルエラー: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * ファイルを処理して要素数をカウント
 * @param filePath
 * @param selector
 * @param processor
 */
export async function parseFile(
	filePath: string,
	selector: string,
	processor?: ProcessorType,
): Promise<number> {
	const content = await readFile(filePath, 'utf8');
	const actualProcessor = processor ?? getDefaultProcessor(filePath);

	switch (actualProcessor) {
		case 'html': {
			return parseHTML(content, selector);
		}
		case 'pug': {
			return parsePug(content, selector);
		}
		default: {
			throw new Error(`Unknown processor: ${actualProcessor}`);
		}
	}
}
