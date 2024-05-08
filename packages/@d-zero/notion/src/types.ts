import type { FieldValue } from './get-value-by-field.js';
import type { ArrayElement } from '@d-zero/shared/types';
import type { Client } from '@notionhq/client';

export type TableData = Record<string, FieldValue[]>;

export type DBOption = {
	sorts?: SortOption[];
};

type SortOption = ArrayElement<
	NonNullable<Parameters<Client['databases']['query']>[0]['sorts']>
>;
