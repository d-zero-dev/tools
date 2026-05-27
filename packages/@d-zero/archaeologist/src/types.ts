import type { PageHookSource } from '@d-zero/puppeteer-page-scan';
import type { Screenshot } from '@d-zero/puppeteer-screenshot';

/**
 * ページごとのスクリーンショットとDOMツリーのデータ
 */
export type PageData = {
	url: string;
	screenshots: Record<string, Screenshot & { domTree: string }>;
};

/**
 * 比較対象のURLペア
 */
export type URLPair = readonly [urlA: string, urlB: string];

/**
 * URLペアの比較結果
 */
export type Result = {
	target: [urlA: string, urlB: string];
	screenshots: Record<string, MediaResult>;
	code: CodeResult | null;
};

/**
 * デバイスサイズごとのメディア比較結果
 */
export type MediaResult = {
	image: ImageResult | null;
	dom: DOMResult | null;
	text: TextResult | null;
};

/**
 * ビジュアル差分の結果
 */
export type ImageResult = {
	/** ピクセル一致率（0〜1） */
	matches: number;
	/** 差分画像のファイルパス */
	file: string;
};

/**
 * DOM差分の結果
 */
export type DOMResult = {
	/** DOM一致率（0〜1） */
	matches: number;
	/** 差分テキスト（差分がない場合はnull） */
	diff: string | null;
	/** 差分ファイルのパス */
	file: string;
};

/**
 * テキスト差分の結果（形態素解析による比較）
 */
export type TextResult = {
	/** テキスト一致率（0〜1） */
	matches: number;
	/** 差分テキスト（差分がない場合はnull） */
	diff: string | null;
	/** 差分ファイルのパス */
	file: string;
};

/**
 * 生HTMLソースの差分結果
 */
export type CodeResult = {
	/** ソースコード一致率（0〜1） */
	matches: number;
	/** 差分テキスト（差分がない場合はnull） */
	diff: string | null;
	/** 差分ファイルのパス */
	file: string;
};

/**
 * Archaeologistの分析オプション
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ArchaeologistOptions extends AnalyzeOptions {}

/**
 * 分析オプション
 */
export interface AnalyzeOptions extends GeneralOptions {
	/** 比較タイプ（`image`, `dom`, `text`, `code`） */
	readonly types?: readonly string[];
	/** 比較対象を限定するCSSセレクター */
	readonly selector?: string;
	/** 無視するCSSセレクター */
	readonly ignore?: string;
	/** デバイスプリセット名 */
	readonly devices?: readonly string[];
	/** 環境AとBのスクリーンショットを左右に並べた合成画像を出力 */
	readonly combined?: boolean;
}

/**
 * フリーズモードのオプション
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FreezeOptions extends GeneralOptions {}

interface GeneralOptions {
	readonly hooks?: PageHookSource;
	readonly limit?: number;
	readonly debug?: boolean;
}
