/**
 * @type {import('@d-zero/archaeologist').PageHook}
 */
export default async function (page, { name, log }) {
	const id = new Date().getSeconds() % 10;
	const delay = 30_000;
	log(`Hook (${name}) is running ${page.url()} %countDown(${delay},${id})%ms`);
	await new Promise((resolve) => setTimeout(resolve, delay));
}
