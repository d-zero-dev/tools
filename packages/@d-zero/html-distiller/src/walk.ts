import type {
	Element,
	ResultNode,
	Template,
	TextNode,
	ChildNode,
	commentNode,
} from './types.js';

export function walk(node: ChildNode): ResultNode {
	switch (node.nodeName) {
		case '#text': {
			return (node as TextNode).value.trim();
		}
		case '#comment': {
			const data = (node as commentNode).data;
			return `<!--${data}-->`;
		}
	}

	const element = node as Element;

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
