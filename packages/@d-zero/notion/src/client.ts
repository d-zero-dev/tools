import { Client } from '@notionhq/client';

const clients = new Map<string, Client>();

export function createClient(auth: string) {
	if (clients.has(auth)) {
		return clients.get(auth)!;
	}
	const client = new Client({
		auth,
	});
	clients.set(auth, client);
	return client;
}
