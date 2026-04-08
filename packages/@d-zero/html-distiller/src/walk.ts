import type {
	Element,
	ResultNode,
	Template,
	TextNode,
	ChildNode,
	commentNode,
} from './types.js';

/**
 *
 * @param node
 */
export function walk(node: ChildNode) {
	switch (node.nodeName) {
		case '#documentType': {
			return '<!DOCTYPE html>';
		}
		case '#text': {
			return (node as TextNode).value.trim();
		}
		case '#comment': {
			const data = (node as commentNode).data;
			return `<!--${data}-->`;
		}
	}

	const element = node as Element;

	if (
		['title', 'link', 'script', 'style', 'iframe'].includes(
			element.nodeName.toLowerCase(),
		)
	) {
		return tagString(element);
	}

	const resultNode: ResultNode = {
		name: element.tagName,
	};

	for (const attribute of element.attrs) {
		if (!resultNode.attr) {
			resultNode.attr = {};
		}
		resultNode.attr[attribute.name] = attribute.value;
	}

	let childNodes: ChildNode[] = element.childNodes;

	if (element.nodeName.toLowerCase() === 'head') {
		childNodes = childNodes.toSorted((a, b) => a.nodeName.localeCompare(b.nodeName));
	}

	if (element.tagName === 'template') {
		const template = element as Template;
		childNodes = template.content.childNodes;
	}

	for (const child of childNodes) {
		if (!resultNode.content) {
			resultNode.content = [];
		}
		const node = walk(child);
		if (node) {
			resultNode.content.push(node);
		}
	}

	return resultNode;
}

/**
 *
 * @param element
 */
function tagString(element: Element) {
	let tag = `<${element.tagName}`;
	const attrs = element.attrs.toSorted((a, b) => a.name.localeCompare(b.name));
	for (const attr of attrs) {
		tag += ` ${attr.name}="${attr.value}"`;
	}
	tag += '>';
	if (element.childNodes.length > 0) {
		tag += element.childNodes.map((child) => walk(child)).join('');
	}
	tag += `</${element.tagName}>`;
	return tag;
}
