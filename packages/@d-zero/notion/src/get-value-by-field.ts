import type {
	PageObjectResponse,
	RichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints.js';

export type Field = PageObjectResponse['properties'][0];
export type FieldValue = string | number | null;

export function getValueByField(field: Field): FieldValue {
	switch (field.type) {
		case 'rich_text': {
			return richTextToPlainText(field.rich_text);
		}
		case 'title': {
			return richTextToPlainText(field.title);
		}
		case 'number': {
			return field.number;
		}
		case 'select': {
			if (!field.select) {
				throw new Error('field.select is null');
			}
			return field.select.name;
		}
	}
	return null;
}

function richTextToPlainText(richText: RichTextItemResponse[]) {
	return richText.map((textBlock) => textBlock.plain_text).join('');
}
