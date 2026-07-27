export type TextType = 'list' | 'grid';

export type Separator = ' ' | '\t' | ',' | ':' | RegExp;

export type KeyValue = {
	key: string;
	value: string;
};

/**
 * A single non-empty, non-comment line surviving `toListWithPosition`'s
 * filtering, tagged with its position in the original source text.
 */
export type ListItem = {
	/** The trimmed line content (comments and blank lines already excluded). */
	value: string;
	/** 1-origin line number in the original source text. */
	line: number;
	/** 1-origin column of `value`'s first character in the original line (i.e. where leading whitespace ended). */
	column: number;
};
