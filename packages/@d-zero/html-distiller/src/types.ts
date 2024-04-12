import type { DefaultTreeAdapterMap } from 'parse5';

export type Document = DefaultTreeAdapterMap['document'];
export type ChildNode = DefaultTreeAdapterMap['childNode'];
export type Element = DefaultTreeAdapterMap['element'];
export type Template = DefaultTreeAdapterMap['template'];
export type TextNode = DefaultTreeAdapterMap['textNode'];
export type commentNode = DefaultTreeAdapterMap['commentNode'];

export type ResultTree = {
	tree: ResultNode[];
};

/**
 * A node in the result tree.
 * It can be a string (text node) or an object (element node).
 */
export type ResultNode =
	| {
			name: string;
			attr?: Record<string, string>;
			content?: ResultNode[];
	  }
	| string;
